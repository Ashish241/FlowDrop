import hashlib
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from services.lan_server.app import create_app


class LANTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.app = create_app(Path(self.tmp.name), "host-secret")
        self.client = TestClient(self.app)
        self.host = {"Authorization": "Bearer host-secret"}
        response = self.client.post(
            "/api/pair", json={"code": self.app.state.pairing_code, "name": "Phone"}
        ).json()
        self.device = response["id"]
        self.phone = {"Authorization": "Bearer " + response["token"]}

    def tearDown(self):
        self.tmp.cleanup()

    def approve(self):
        self.assertEqual(
            self.client.post(
                f"/api/devices/{self.device}/approve", headers=self.host
            ).status_code,
            200,
        )

    def offer(self, data):
        return self.client.post(
            "/api/transfers",
            headers=self.host,
            json={
                "name": "../../hello.bin",
                "size": len(data),
                "recipient": self.device,
                "sha256": hashlib.sha256(data).hexdigest(),
            },
        ).json()["id"]

    def test_approval_and_revocation(self):
        self.assertEqual(
            self.client.get("/api/devices", headers=self.phone).status_code, 401
        )
        self.approve()
        self.assertEqual(
            self.client.get("/api/devices", headers=self.phone).status_code, 200
        )
        self.client.delete(f"/api/devices/{self.device}", headers=self.host)
        self.assertEqual(
            self.client.get("/api/devices", headers=self.phone).status_code, 401
        )

    def test_binary_transfer_and_duplicate(self):
        self.approve()
        data = bytes(range(256)) * 100
        tid = self.offer(data)
        self.assertEqual(
            self.client.put(
                f"/api/transfers/{tid}/chunks/0", headers=self.host, content=data
            ).status_code,
            409,
        )
        self.client.post(f"/api/transfers/{tid}/accept", headers=self.phone)
        for _ in range(2):
            self.assertEqual(
                self.client.put(
                    f"/api/transfers/{tid}/chunks/0", headers=self.host, content=data
                ).status_code,
                200,
            )
        self.assertEqual(
            self.client.post(
                f"/api/transfers/{tid}/finish", headers=self.host
            ).status_code,
            200,
        )
        r = self.client.get(f"/api/transfers/{tid}/download", headers=self.phone)
        self.assertEqual(r.content, data)
        self.assertIn("hello.bin", r.headers["content-disposition"])
        self.assertEqual(
            self.client.get(f"/api/transfers/{tid}/download").status_code, 401
        )

    def test_zero_bytes(self):
        self.approve()
        tid = self.offer(b"")
        self.client.post(f"/api/transfers/{tid}/accept", headers=self.phone)
        self.assertEqual(
            self.client.post(
                f"/api/transfers/{tid}/finish", headers=self.host
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(
                f"/api/transfers/{tid}/download", headers=self.phone
            ).content,
            b"",
        )

    def test_integrity_and_origin(self):
        self.approve()
        tid = self.offer(b"abc")
        self.client.post(f"/api/transfers/{tid}/accept", headers=self.phone)
        self.client.put(
            f"/api/transfers/{tid}/chunks/0", headers=self.host, content=b"xyz"
        )
        self.assertEqual(
            self.client.post(
                f"/api/transfers/{tid}/finish", headers=self.host
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(
                "/api/pair",
                headers={"Origin": "https://evil.example"},
                json={"code": self.app.state.pairing_code, "name": "bad"},
            ).status_code,
            403,
        )

    def test_websocket_auth_and_text(self):
        self.approve()
        with (
            self.client.websocket_connect("/api/ws") as host,
            self.client.websocket_connect("/api/ws") as phone,
        ):
            host.send_text("host-secret")
            phone.send_text(self.phone["Authorization"][7:])
            host.send_json(
                {
                    "type": "text",
                    "recipient": self.device,
                    "text": "こんにちは\ncode <script>",
                }
            )
            self.assertEqual(phone.receive_json()["text"], "こんにちは\ncode <script>")

    def test_restart_resume_and_privacy(self):
        self.approve()
        data = b"resumable"
        tid = self.offer(data)
        self.client.post(f"/api/transfers/{tid}/accept", headers=self.phone)
        self.client.put(
            f"/api/transfers/{tid}/chunks/0", headers=self.host, content=data
        )
        restarted = TestClient(create_app(Path(self.tmp.name), "new-host-token"))
        self.assertEqual(
            restarted.get("/api/transfers", headers=self.phone).status_code, 200
        )
        self.assertEqual(
            restarted.post(
                f"/api/transfers/{tid}/finish",
                headers={"Authorization": "Bearer new-host-token"},
            ).status_code,
            200,
        )
        self.assertEqual(
            restarted.get(f"/api/transfers/{tid}/download", headers=self.phone).content,
            data,
        )
        stranger = self.client.post(
            "/api/pair", json={"code": self.app.state.pairing_code, "name": "Stranger"}
        ).json()
        self.client.post(f"/api/devices/{stranger['id']}/approve", headers=self.host)
        self.assertEqual(
            self.client.get(
                f"/api/transfers/{tid}/download",
                headers={"Authorization": "Bearer " + stranger["token"]},
            ).status_code,
            404,
        )

    def test_out_of_order_pause_and_download_ticket(self):
        self.approve()
        data = b"a" * 1048576 + b"end"
        tid = self.offer(data)
        path = f"/api/transfers/{tid}"
        self.client.post(path + "/accept", headers=self.phone)
        self.assertEqual(
            self.client.put(
                path + "/chunks/1", headers=self.host, content=b"end"
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(path + "/finish", headers=self.host).status_code, 409
        )
        self.client.post(path + "/pause", headers=self.phone)
        self.assertEqual(
            self.client.put(
                path + "/chunks/0", headers=self.host, content=data[:1048576]
            ).status_code,
            409,
        )
        self.client.post(path + "/resume", headers=self.host)
        self.client.put(path + "/chunks/0", headers=self.host, content=data[:1048576])
        self.assertEqual(
            self.client.post(path + "/finish", headers=self.host).status_code, 200
        )
        self.assertEqual(
            self.client.post(path + "/download-ticket", headers=self.host).status_code,
            403,
        )
        response = self.client.post(path + "/download-ticket", headers=self.phone)
        self.assertIn("HttpOnly", response.headers["set-cookie"])
        self.assertEqual(self.client.get(path + "/download").content, data)
        self.client.delete(f"/api/devices/{self.device}", headers=self.host)
        self.assertEqual(self.client.get(path + "/download").status_code, 401)

    def test_cancel_and_request_bounds(self):
        self.approve()
        tid = self.offer(b"abc")
        path = f"/api/transfers/{tid}"
        self.client.post(path + "/accept", headers=self.phone)
        self.assertEqual(
            self.client.put(
                path + "/chunks/-1", headers=self.host, content=b"abc"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.put(
                path + "/chunks/0", headers=self.host, content=b"ab"
            ).status_code,
            400,
        )
        self.client.put(path + "/chunks/0", headers=self.host, content=b"abc")
        self.assertTrue((Path(self.tmp.name) / tid / "0").exists())
        self.client.delete(path, headers=self.phone)
        self.assertFalse((Path(self.tmp.name) / tid).exists())
        self.assertEqual(
            self.client.post(path + "/finish", headers=self.host).status_code, 409
        )
        self.assertEqual(
            self.client.post(
                "/api/pair", headers={"Content-Length": "999999"}, content=b"{}"
            ).status_code,
            413,
        )

    def test_pairing_expiry_renewal_and_rate_limit(self):
        import time
        from unittest.mock import patch

        with patch("services.lan_server.app.time.time", return_value=time.time() + 601):
            self.assertEqual(
                self.client.post(
                    "/api/pair",
                    json={"code": self.app.state.pairing_code, "name": "Expired"},
                ).status_code,
                403,
            )
            response = self.client.post("/api/pair/renew", headers=self.host)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                self.client.post(
                    "/api/pair",
                    json={"code": response.json()["pairing_code"], "name": "Renewed"},
                ).status_code,
                200,
            )
        for _ in range(6):
            response = self.client.post(
                "/api/pair", json={"code": "bad", "name": "Bad"}
            )
        self.assertEqual(response.status_code, 429)

    def test_negotiated_chunks_survive_configuration_change(self):
        import os
        from unittest.mock import patch

        self.approve()
        with patch.dict(os.environ, {"FLOWDROP_CHUNK_SIZE": "2097152"}):
            client = TestClient(create_app(Path(self.tmp.name), "new-host"))
        host = {"Authorization": "Bearer new-host"}
        data = b"a" * 1048576 + b"end"
        response = client.post(
            "/api/transfers",
            headers=host,
            json={
                "name": "large.bin",
                "size": len(data),
                "recipient": self.device,
                "sha256": hashlib.sha256(data).hexdigest(),
            },
        ).json()
        self.assertEqual(response["chunk_size"], 2097152)
        path = "/api/transfers/" + response["id"]
        client.post(path + "/accept", headers=self.phone)
        self.assertEqual(
            client.put(path + "/chunks/0", headers=host, content=data).status_code, 200
        )
        self.assertNotIn(
            "chunks", client.get("/api/transfers", headers=self.phone).json()[0]
        )
        self.assertEqual(client.get(path, headers=host).json()["completed_chunks"], [0])
        restarted = TestClient(create_app(Path(self.tmp.name), "restarted-host"))
        self.assertEqual(
            restarted.post(
                path + "/finish", headers={"Authorization": "Bearer restarted-host"}
            ).status_code,
            200,
        )
        self.assertEqual(
            restarted.get(path + "/download", headers=self.phone).content, data
        )


if __name__ == "__main__":
    unittest.main()
