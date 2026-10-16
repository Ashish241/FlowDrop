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

    def test_rotation_is_atomic_and_preserves_membership(self):
        app = create_app()
        stamp = [10000.0]
        app.state.room_clock = lambda: stamp[0]
        client = TestClient(app)
        a = client.post("/v2/rooms", json={"name": "Owner"}).json()
        b = client.post(
            "/v2/rooms/" + a["code"] + "/join", json={"name": "Peer"}
        ).json()
        path = "/v2/rooms/" + a["room"] + "/ws"
        with client.websocket_connect(path, headers=ORIGIN) as sa:
            sa.send_text(a["token"])
            sa.receive_json()
            with client.websocket_connect(path, headers=ORIGIN) as sb:
                sb.send_text(b["token"])
                sb.receive_json()
                sa.receive_json()
                stamp[0] += 601
                sa.send_json({"type": "ping"})
                frames = [sa.receive_json(), sa.receive_json()]
                updated = next(frame for frame in frames if frame["type"] == "members")
                self.assertNotEqual(updated["code"], a["code"])
                self.assertEqual(
                    {m["id"] for m in updated["members"]}, {a["member"], b["member"]}
                )
                self.assertEqual(sb.receive_json()["code"], updated["code"])
                self.assertEqual(
                    client.post(
                        "/v2/rooms/" + a["code"] + "/join", json={"name": "Old"}
                    ).status_code,
                    404,
                )
                # Consecutive pings at the same time must not rotate twice.
                sb.send_json({"type": "ping"})
                self.assertEqual(sb.receive_json()["type"], "pong")
                c = client.post(
                    "/v2/rooms/" + updated["code"] + "/join", json={"name": "New"}
                ).json()
                self.assertEqual(c["room"], a["room"])
                sa.receive_json()
                sb.receive_json()
                sa.send_json(
                    {"type": "offer", "to": b["member"], "sdp": "after-rotation"}
                )
                self.assertEqual(sb.receive_json()["sdp"], "after-rotation")

    def test_authenticated_heartbeats_extend_idle_room_and_keep_absolute_bound(self):
        app = create_app()
        stamp = [10000.0]
        app.state.room_clock = lambda: stamp[0]
        client = TestClient(app)
        a = client.post("/v2/rooms", json={"name": "Owner"}).json()
        with client.websocket_connect(
            "/v2/rooms/" + a["room"] + "/ws", headers=ORIGIN
        ) as ws:
            ws.send_text(a["token"])
            ws.receive_json()
            # Advance less than invitation lifetime per step, well beyond old one-hour expiry.
            for _ in range(8):
                stamp[0] += 500
                ws.send_json({"type": "ping"})
                frame = ws.receive_json()
                if frame["type"] == "members":
                    frame = ws.receive_json()
                self.assertEqual(frame["type"], "pong")
            response = client.get(
                "/v2/rooms/" + a["room"] + "/ice",
                headers={"Authorization": "Bearer " + a["token"]},
            )
            self.assertEqual(response.status_code, 200)
        stamp[0] += 3601
        self.assertEqual(
            client.get(
                "/v2/rooms/" + a["room"] + "/ice",
                headers={"Authorization": "Bearer " + a["token"]},
            ).status_code,
            404,
        )
