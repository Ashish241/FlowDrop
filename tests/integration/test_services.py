"""Real disposable services only; never substitute mocks for these tests."""

import os
import secrets
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from redis import Redis

from services.cloud_api.app import LocalStore, S3Store, Share, create_app
from services.request_security import RedisRateLimit
from services.signaling.distributed import create_distributed_app

pytestmark = pytest.mark.skipif(
    not os.getenv("FLOWDROP_INTEGRATION"),
    reason="Disposable service URLs not configured",
)


def test_redis_cross_instance_approval_routing_revocation():
    prefix = "flowdrop:test:" + secrets.token_hex(8) + ":"
    with (
        TestClient(create_distributed_app(prefix=prefix)) as first,
        TestClient(create_distributed_app(prefix=prefix)) as second,
    ):
        owner = first.post("/rooms").json()
        path = "/rooms/" + owner["room"]
        with first.websocket_connect(path + "/ws") as a:
            a.send_text(owner["token"])
            assert a.receive_json()["type"] == "authorized"
            receiver = second.post("/rooms/" + owner["pairing_code"] + "/join").json()
            assert receiver["room"] == owner["room"]
            with second.websocket_connect(path + "/ws") as b:
                b.send_text(receiver["token"])
                assert b.receive_json()["type"] == "authorized"
                assert a.receive_json()["type"] == "join-request"
                a.send_json({"type": "approve"})
                assert b.receive_json()["type"] == "approved"
                assert a.receive_json()["type"] == "ready"
                a.send_json({"type": "offer", "sdp": "cross-worker"})
                assert b.receive_json()["sdp"] == "cross-worker"
                assert (
                    first.delete(
                        path, headers={"Authorization": "Bearer " + owner["token"]}
                    ).status_code
                    == 200
                )
                assert second.get(
                    "/ice", headers={"Authorization": "Bearer " + receiver["token"]}
                ).status_code in (401, 404)
                from starlette.websockets import WebSocketDisconnect

                with pytest.raises(WebSocketDisconnect) as revoked:
                    b.receive_json()
                assert revoked.value.code == 1008


def test_redis_atomic_join_expiry_and_distributed_limit():
    prefix = "flowdrop:test:" + secrets.token_hex(8) + ":"
    with (
        TestClient(create_distributed_app(prefix=prefix)) as first,
        TestClient(create_distributed_app(prefix=prefix)) as second,
    ):
        owner = first.post("/rooms").json()
        path = "/rooms/" + owner["room"]
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(
                pool.map(lambda client: client.post(path + "/join"), [first, second])
            )
        assert sorted(r.status_code for r in responses) == [200, 409]
        redis = Redis.from_url(os.environ["REDIS_URL"])
        redis.delete(prefix + "room:" + owner["room"])
        assert second.post(path + "/join").status_code == 404
        a = RedisRateLimit(os.environ["REDIS_URL"], prefix + "limit:", 1, 60)
        b = RedisRateLimit(os.environ["REDIS_URL"], prefix + "limit:", 1, 60)
        assert a.allow("same-ip")
        assert not b.allow("same-ip")


def test_redis_room_survives_worker_restart_and_expires():
    import time

    prefix = "flowdrop:test:" + secrets.token_hex(8) + ":"
    with TestClient(create_distributed_app(prefix=prefix)) as first:
        owner = first.post("/rooms").json()
    with TestClient(create_distributed_app(prefix=prefix)) as restarted:
        headers = {"Authorization": "Bearer " + owner["token"]}
        assert restarted.get("/ice", headers=headers).status_code == 200
        redis = Redis.from_url(os.environ["REDIS_URL"])
        redis.pexpire(prefix + "room:" + owner["room"], 10)
        time.sleep(0.03)
        assert restarted.get("/ice", headers=headers).status_code == 404


def test_redis_code_expiry_and_reuse_cannot_be_revoked_by_old_room(monkeypatch):
    monkeypatch.setenv(
        "FLOWDROP_TURN_URLS", '["turn:relay.example.com:3478?transport=tcp"]'
    )
    monkeypatch.setenv("FLOWDROP_TURN_SECRET", "x" * 64)
    import time
    from unittest.mock import patch

    prefix = "flowdrop:test:" + secrets.token_hex(8) + ":"
    redis = Redis.from_url(os.environ["REDIS_URL"])
    with TestClient(create_distributed_app(prefix=prefix)) as client:
        with patch(
            "services.signaling.distributed.secrets.randbelow", return_value=123
        ):
            old = client.post("/rooms").json()
            assert old["pairing_code"] == "000123"
            assert client.post("/rooms").status_code == 503
            redis.pexpire(prefix + "code:000123", 1)
            time.sleep(0.03)
            assert client.post("/rooms/000123/join").status_code == 404
            new = client.post("/rooms").json()
        assert (
            client.delete(
                "/rooms/" + old["room"],
                headers={"Authorization": "Bearer " + old["token"]},
            ).status_code
            == 200
        )
        receiver = client.post("/rooms/000123/join").json()
        assert receiver["room"] == new["room"]
        pending = client.get(
            "/ice", headers={"Authorization": "Bearer " + receiver["token"]}
        ).json()
        assert pending["pendingApproval"] is True
        assert not any("credential" in server for server in pending["iceServers"])


def test_postgres_atomic_quota_and_download_limits(tmp_path):
    database = os.environ["DATABASE_URL"]
    from sqlalchemy import create_engine, text

    engine = create_engine(database)
    with engine.connect() as connection:
        baseline_reserved = connection.scalar(
            text("SELECT COALESCE(SUM(bytes_limit),0) FROM shares")
        )
    engine.dispose()
    app = create_app(
        database, LocalStore(tmp_path / "objects"), quota_bytes=baseline_reserved + 40
    )
    with TestClient(app) as client:
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(
                pool.map(
                    lambda _: client.post(
                        "/shares",
                        json={
                            "chunks": 1,
                            "bytes_limit": 30,
                            "ttl": 60,
                            "download_limit": 1,
                        },
                    ),
                    range(2),
                )
            )
        assert sorted(r.status_code for r in responses) == [200, 507]
        share = next(r.json() for r in responses if r.status_code == 200)
        path = "/shares/" + share["id"]
        up = {"Authorization": "Bearer " + share["upload_token"]}
        down = {"Authorization": "Bearer " + share["download_token"]}
        with ThreadPoolExecutor(max_workers=2) as pool:
            uploads = list(
                pool.map(
                    lambda _: client.put(
                        path + "/chunks/0", headers=up, content=b"x" * 16
                    ),
                    range(2),
                )
            )
        assert [response.status_code for response in uploads] == [200, 200]
        assert uploads[0].json() == uploads[1].json()
        assert client.post(path + "/finish", headers=up).status_code == 200
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(
                pool.map(
                    lambda _: client.post(path + "/downloads", headers=down), range(2)
                )
            )
        assert sorted(r.status_code for r in responses) == [200, 410]
        assert client.delete(path, headers=up).status_code == 200
    app.state.engine.dispose()


@pytest.mark.skipif(
    not os.getenv("S3_ENDPOINT"), reason="Disposable S3 service not configured"
)
def test_real_s3_stream_cleanup_missing_objects_and_private_access(tmp_path):
    import httpx
    from sqlalchemy.orm import Session

    store = S3Store()
    app = create_app(os.environ["DATABASE_URL"], store)
    with TestClient(app) as client:
        share = client.post(
            "/shares", json={"chunks": 1, "bytes_limit": 262144, "ttl": 60}
        ).json()
        path = "/shares/" + share["id"]
        up = {"Authorization": "Bearer " + share["upload_token"]}
        down = {"Authorization": "Bearer " + share["download_token"]}
        ciphertext = secrets.token_bytes(131072)
        assert (
            client.put(path + "/chunks/0", headers=up, content=ciphertext).status_code
            == 200
        )
        assert client.post(path + "/finish", headers=up).status_code == 200
        assert client.get(path + "/chunks/0", headers=down).content == ciphertext
        assert (
            httpx.get(
                os.environ["S3_ENDPOINT"]
                + "/"
                + store.bucket
                + "/"
                + share["id"]
                + "-0"
            ).status_code
            == 403
        )
        store.delete(share["id"] + "-0")
        assert client.get(path + "/chunks/0", headers=down).status_code == 503
        orphan = tmp_path / "orphan"
        orphan.write_bytes(ciphertext)
        store.put(share["id"] + "-orphan", orphan)
        with Session(app.state.engine) as db:
            db.get(Share, share["id"]).expires = 0
            db.commit()
        app.state.cleanup()
        assert not store.client.list_objects_v2(
            Bucket=store.bucket, Prefix=share["id"] + "-"
        ).get("Contents")
        assert client.get(path, headers=down).status_code == 404
        second = client.post(
            "/shares", json={"chunks": 1, "bytes_limit": 32, "ttl": 60}
        ).json()
        path = "/shares/" + second["id"]
        up = {"Authorization": "Bearer " + second["upload_token"]}
        bucket = store.bucket
        store.bucket = "nonexistent-flowdrop-test-" + secrets.token_hex(8)
        assert (
            client.put(path + "/chunks/0", headers=up, content=b"x" * 16).status_code
            == 503
        )
        assert (
            client.get(path + "/upload-status", headers=up).json()["completed_chunks"]
            == []
        )
        store.bucket = bucket
        assert (
            client.put(path + "/chunks/0", headers=up, content=b"x" * 16).status_code
            == 200
        )
        assert client.delete(path, headers=up).status_code == 200
    app.state.engine.dispose()
