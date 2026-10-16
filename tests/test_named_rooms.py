import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.signaling.app import create_app

ORIGIN = {"origin": "http://127.0.0.1:8000"}


class NamedRoomTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app())

    def create(self, name="Laptop"):
        response = self.client.post("/v2/rooms", json={"name": name})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def join(self, a, name="Phone"):
        return self.client.post("/v2/rooms/" + a["code"] + "/join", json={"name": name})

    def test_names_lock_membership_and_expiry(self):
        for name in ["", "  ", "x" * 33, "a\nname"]:
            self.assertEqual(
                self.client.post("/v2/rooms", json={"name": name}).status_code, 422
            )
        a = self.create("  My PC  ")
        self.assertEqual(a["members"][0]["name"], "My PC")
        self.assertEqual(len(a["code"]), 6)
        b = self.join(a, "My PC").json()
        self.assertNotEqual(a["member"], b["member"])
        self.assertNotEqual(a["token"], b["token"])
        self.assertNotIn("token", b["members"][0])
        path = "/v2/rooms/" + a["room"]
        with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as sa:
            sa.send_text(a["token"])
            sa.receive_json()
            sa.send_json({"type": "lock", "locked": True})
            self.assertTrue(sa.receive_json()["locked"])
            self.assertEqual(self.join(a).status_code, 423)
        with patch(
            "services.signaling.rooms.time.time", return_value=a["code_expires"] + 1
        ):
            self.assertEqual(self.join(a).status_code, 404)
        with patch("services.signaling.rooms.time.time", return_value=a["expires"] + 1):
            self.assertEqual(
                self.client.get(
                    path + "/ice", headers={"Authorization": "Bearer " + a["token"]}
                ).status_code,
                404,
            )

    def test_auto_join_rename_authorization_and_addressed_routing(self):
        a = self.create()
        b = self.join(a).json()
        c = self.join(a, "Tablet").json()
        path = "/v2/rooms/" + a["room"]
        with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as sa:
            sa.send_text(a["token"])
            sa.receive_json()
            with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as sb:
                sb.send_text(b["token"])
                sb.receive_json()
                sa.receive_json()
                # No approval event: membership is already authenticated and active.
                sb.send_json(
                    {"type": "rename", "name": "Renamed", "member": a["member"]}
                )
                self.assertEqual(sb.receive_json()["type"], "error")
                sb.send_json({"type": "lock", "locked": True})
                self.assertEqual(sb.receive_json()["type"], "error")
                sb.send_json({"type": "rename", "name": "<script>safe</script>"})
                event = sa.receive_json()
                sb.receive_json()
                self.assertEqual(
                    next(m for m in event["members"] if m["id"] == b["member"])["name"],
                    "<script>safe</script>",
                )
                sa.send_json(
                    {
                        "type": "offer",
                        "to": b["member"],
                        "from": c["member"],
                        "sdp": "real-routing",
                    }
                )
                event = sb.receive_json()
                self.assertEqual(event["from"], a["member"])
                self.assertEqual(event["sdp"], "real-routing")
                sa.send_json({"type": "offer", "to": "outsider", "sdp": "no"})
                self.assertEqual(sa.receive_json()["type"], "error")
                response = self.client.delete(
                    path + "/membership",
                    headers={"Authorization": "Bearer " + b["token"]},
                )
                self.assertEqual(response.json()["status"], "left")
                self.assertEqual(sa.receive_json()["event"], "left")
        self.assertEqual(
            self.client.get(
                path + "/ice", headers={"Authorization": "Bearer " + b["token"]}
            ).status_code,
            403,
        )

    def test_bruteforce_lockout_and_capacity(self):
        for _ in range(20):
            self.assertEqual(
                self.client.post(
                    "/v2/rooms/999999/join", json={"name": "Probe"}
                ).status_code,
                404,
            )
        self.assertEqual(
            self.client.post(
                "/v2/rooms/999999/join", json={"name": "Probe"}
            ).status_code,
            429,
        )
        self.client = TestClient(create_app())
        a = self.create()
        for i in range(7):
            self.assertEqual(self.join(a, str(i)).status_code, 200)
        self.assertEqual(self.join(a).status_code, 409)

    def test_end_revokes_all_tokens(self):
        a = self.create()
        b = self.join(a).json()
        path = "/v2/rooms/" + a["room"]
        self.assertEqual(
            self.client.delete(
                path + "/membership", headers={"Authorization": "Bearer " + a["token"]}
            ).json()["status"],
            "ended",
        )
        self.assertEqual(
            self.client.get(
                path + "/ice", headers={"Authorization": "Bearer " + b["token"]}
            ).status_code,
            404,
        )
        self.assertEqual(self.join(a).status_code, 404)
