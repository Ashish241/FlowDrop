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

    def test_generation_routing_and_single_reset_initiator(self):
        a = self.create()
        b = self.join(a).json()
        low, high = sorted([a, b], key=lambda m: m["member"])
        path = "/v2/rooms/" + a["room"] + "/ws"
        generation = "11111111-1111-4111-8111-111111111111"
        with self.client.websocket_connect(path, headers=ORIGIN) as first:
            first.send_text(low["token"])
            first.receive_json()
            with self.client.websocket_connect(path, headers=ORIGIN) as second:
                second.send_text(high["token"])
                second.receive_json()
                first.receive_json()
                first.send_json(
                    {
                        "type": "retry",
                        "to": high["member"],
                        "generation": generation,
                        "reset": True,
                    }
                )
                event = second.receive_json()
                self.assertTrue(event["reset"])
                self.assertEqual(event["generation"], generation)
                second.send_json(
                    {
                        "type": "retry",
                        "to": low["member"],
                        "generation": generation,
                        "reset": True,
                    }
                )
                event = first.receive_json()
                self.assertNotIn("reset", event)
                self.assertEqual(event["from"], high["member"])
                first.send_json(
                    {
                        "type": "offer",
                        "to": high["member"],
                        "sdp": "invalid-generation",
                        "generation": "x" * 1000,
                    }
                )
                first.send_json(
                    {
                        "type": "offer",
                        "to": high["member"],
                        "sdp": "bounded-generation",
                        "generation": generation,
                    }
                )
                self.assertEqual(second.receive_json()["sdp"], "bounded-generation")

    def test_host_refresh_preserves_room_and_revokes_old_invitation(self):
        a = self.create()
        b = self.join(a).json()
        path = "/v2/rooms/" + a["room"]
        auth = {"Authorization": "Bearer " + a["token"]}
        guest = {"Authorization": "Bearer " + b["token"]}
        self.assertEqual(
            self.client.post(path + "/invitation", headers=guest).status_code, 403
        )
        self.assertEqual(self.client.post(path + "/invitation").status_code, 403)
        with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as ws:
            ws.send_text(a["token"])
            ws.receive_json()
            ws.send_json({"type": "lock", "locked": True})
            ws.receive_json()
            result = self.client.post(path + "/invitation", headers=auth)
            self.assertEqual(result.status_code, 200)
            data = result.json()
            self.assertTrue(data["locked"])
            self.assertNotEqual(data["code"], a["code"])
            self.assertEqual(data["owner"], a["owner"])
            self.assertEqual(len(data["members"]), 2)
            self.assertEqual(ws.receive_json()["code"], data["code"])
            self.assertEqual(self.join(a).status_code, 404)
            self.assertEqual(self.join(data).status_code, 423)
            self.assertEqual(
                self.client.get(path + "/ice", headers=guest).status_code, 200
            )

    def test_host_removal_revokes_token_socket_and_preserves_unrelated_member(self):
        a = self.create()
        b = self.join(a).json()
        c = self.join(a, "Tablet").json()
        path = "/v2/rooms/" + a["room"]
        auth = {"Authorization": "Bearer " + a["token"]}
        guest = {"Authorization": "Bearer " + b["token"]}
        target = path + "/members/" + b["member"]
        self.assertEqual(self.client.delete(target, headers=guest).status_code, 403)
        self.assertEqual(
            self.client.delete(
                path + "/members/" + a["member"], headers=auth
            ).status_code,
            400,
        )
        with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as ws:
            ws.send_text(b["token"])
            ws.receive_json()
            self.assertEqual(self.client.delete(target, headers=auth).status_code, 200)
            self.assertEqual(ws.receive_json()["type"], "removed")
            event = ws.receive()
            self.assertEqual(event["type"], "websocket.close")
            self.assertEqual(event["code"], 4003)
        self.assertEqual(self.client.get(path + "/ice", headers=guest).status_code, 403)
        self.assertEqual(
            self.client.get(
                path + "/ice", headers={"Authorization": "Bearer " + c["token"]}
            ).status_code,
            200,
        )
        with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as ws:
            ws.send_text(b["token"])
            self.assertEqual(ws.receive()["type"], "websocket.close")
        # Anonymous removal is revocation, not a permanent identity ban.
        self.assertEqual(self.join(a).status_code, 200)

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
        def next_event(socket):
            # Heartbeats can interleave when this test is paused by a busy host.
            for _ in range(20):
                value = socket.receive_json()
                if value.get("type") != "pong":
                    return value
            self.fail("Expected a room event after heartbeat frames")

        a = self.create()
        b = self.join(a).json()
        c = self.join(a, "Tablet").json()
        path = "/v2/rooms/" + a["room"]
        with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as sa:
            sa.send_text(a["token"])
            next_event(sa)
            with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as sb:
                sb.send_text(b["token"])
                next_event(sb)
                next_event(sa)
                # No approval event: membership is already authenticated and active.
                sb.send_json(
                    {"type": "rename", "name": "Renamed", "member": a["member"]}
                )
                self.assertEqual(next_event(sb)["type"], "error")
                sb.send_json({"type": "lock", "locked": True})
                self.assertEqual(next_event(sb)["type"], "error")
                sb.send_json({"type": "rename", "name": "<script>safe</script>"})
                event = next_event(sa)
                next_event(sb)
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
                event = next_event(sb)
                self.assertEqual(event["from"], a["member"])
                self.assertEqual(event["sdp"], "real-routing")
                sa.send_json({"type": "offer", "to": "outsider", "sdp": "no"})
                self.assertEqual(next_event(sa)["type"], "error")
                response = self.client.delete(
                    path + "/membership",
                    headers={"Authorization": "Bearer " + b["token"]},
                )
                self.assertEqual(response.json()["status"], "left")
                self.assertEqual(next_event(sa)["event"], "left")
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

    def test_end_notifies_connected_peer_and_closes_with_terminal_code(self):
        from starlette.websockets import WebSocketDisconnect

        a = self.create()
        b = self.join(a).json()
        path = "/v2/rooms/" + a["room"]
        with self.client.websocket_connect(path + "/ws", headers=ORIGIN) as peer:
            peer.send_text(b["token"])
            peer.receive_json()
            response = self.client.delete(
                path + "/membership", headers={"Authorization": "Bearer " + a["token"]}
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(peer.receive_json(), {"type": "ended"})
            with self.assertRaises(WebSocketDisconnect) as closed:
                peer.receive_json()
            self.assertEqual(closed.exception.code, 4001)
            self.assertEqual(
                self.client.get(
                    path + "/ice", headers={"Authorization": "Bearer " + b["token"]}
                ).status_code,
                404,
            )
        self.assertEqual(self.join(a).status_code, 404)

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
