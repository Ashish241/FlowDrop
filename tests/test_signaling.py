import unittest

from fastapi.testclient import TestClient

from services.signaling.app import create_app


class SignalingTests(unittest.TestCase):
    def test_authorized_approval_and_sdp(self):
        client = TestClient(create_app())
        owner = client.post("/rooms").json()
        path = f"/rooms/{owner['room']}"
        with client.websocket_connect(path + "/ws") as a:
            a.send_text(owner["token"])
            self.assertEqual(a.receive_json()["type"], "authorized")
            receiver = client.post(path + "/join").json()
            with client.websocket_connect(path + "/ws") as b:
                b.send_text(receiver["token"])
                self.assertFalse(b.receive_json()["approved"])
                self.assertEqual(a.receive_json()["type"], "join-request")
                a.send_json({"type": "approve"})
                self.assertEqual(b.receive_json()["type"], "approved")
                self.assertEqual(a.receive_json()["type"], "ready")
                a.send_json({"type": "file", "data": "not-a-signaling-message"})
                a.send_json({"type": "offer", "sdp": "test-sdp"})
                self.assertEqual(b.receive_json()["sdp"], "test-sdp")
                b.send_json({"type": "answer", "sdp": "answer"})
                self.assertEqual(a.receive_json()["sdp"], "answer")
        self.assertEqual(client.post(path + "/join").status_code, 409)

    def test_origins_and_unknown_room(self):
        client = TestClient(create_app())
        self.assertEqual(
            client.post(
                "/rooms", headers={"Origin": "https://evil.example"}
            ).status_code,
            403,
        )
        self.assertEqual(client.post("/rooms/missing/join").status_code, 404)
