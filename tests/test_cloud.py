import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from services.cloud_api.app import LocalStore, create_app


class CloudTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        root = Path(self.tmp.name)
        self.app = create_app(
            "sqlite:///" + str(root / "meta.db"), LocalStore(root / "objects")
        )
        self.client = TestClient(self.app)

    def tearDown(self):
        self.app.state.engine.dispose()
        self.tmp.cleanup()

    def test_upload_completeness_and_revoke(self):
        s = self.client.post(
            "/shares", json={"chunks": 2, "bytes_limit": 100, "ttl": 60}
        ).json()
        path = "/shares/" + s["id"]
        up = {"Authorization": "Bearer " + s["upload_token"]}
        down = {"Authorization": "Bearer " + s["download_token"]}
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(
            self.client.post(path + "/finish", headers=up).status_code, 409
        )
        for i in range(2):
            self.assertEqual(
                self.client.put(
                    path + f"/chunks/{i}", headers=up, content=b"ciphertext-with-tag"
                ).status_code,
                200,
            )
        self.assertEqual(
            self.client.put(
                path + "/chunks/0", headers=up, content=b"different-ciphertext"
            ).status_code,
            409,
        )
        self.assertEqual(
            self.client.post(path + "/finish", headers=up).status_code, 200
        )
        self.assertEqual(self.client.get(path, headers=down).json()["chunks"], 2)
        self.assertEqual(
            self.client.get(path + "/chunks/1", headers=down).content,
            b"ciphertext-with-tag",
        )
        self.assertEqual(self.client.delete(path, headers=up).status_code, 200)
        self.assertEqual(self.client.get(path, headers=down).status_code, 404)

    def test_expiry_cleanup(self):
        import unittest.mock

        s = self.client.post(
            "/shares", json={"chunks": 1, "bytes_limit": 32, "ttl": 60}
        ).json()
        with unittest.mock.patch(
            "services.cloud_api.app.time.time", return_value=s["expires"] + 1
        ):
            self.assertEqual(
                self.client.get(
                    "/shares/" + s["id"],
                    headers={"Authorization": "Bearer " + s["download_token"]},
                ).status_code,
                410,
            )
            self.app.state.cleanup()
        self.assertEqual(
            self.client.get(
                "/shares/" + s["id"],
                headers={"Authorization": "Bearer " + s["download_token"]},
            ).status_code,
            404,
        )

    def test_atomic_quota_and_orphan_cleanup(self):
        from concurrent.futures import ThreadPoolExecutor

        root = Path(self.tmp.name)
        app = create_app(
            "sqlite:///" + str(root / "quota.db"),
            LocalStore(root / "quota-objects"),
            quota_bytes=40,
        )
        client = TestClient(app)
        try:

            def reserve(_):
                return client.post(
                    "/shares", json={"chunks": 1, "bytes_limit": 30, "ttl": 60}
                )

            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(reserve, range(2)))
            self.assertEqual(sorted(r.status_code for r in responses), [200, 507])
            share = next(r.json() for r in responses if r.status_code == 200)
            orphan = root / "quota-objects" / (share["id"] + "-0")
            orphan.write_bytes(b"untracked ciphertext")
            self.assertEqual(
                client.delete(
                    "/shares/" + share["id"],
                    headers={"Authorization": "Bearer " + share["upload_token"]},
                ).status_code,
                200,
            )
            self.assertFalse(orphan.exists())
        finally:
            app.state.engine.dispose()
