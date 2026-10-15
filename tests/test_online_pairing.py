import re
from unittest.mock import patch

from fastapi.testclient import TestClient

from services.signaling.app import create_app


def test_short_code_is_temporary_and_preserves_receiver_authorization(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    with TestClient(create_app()) as client:
        owner = client.post("/rooms").json()
        assert re.fullmatch(r"[0-9]{6}", owner["pairing_code"])
        joined = client.post("/rooms/" + owner["pairing_code"] + "/join").json()
        assert joined["room"] == owner["room"]
        assert joined["token"] != owner["token"]
        assert (
            client.delete(
                "/rooms/" + owner["room"],
                headers={"Authorization": "Bearer " + joined["token"]},
            ).status_code
            == 403
        )
        assert (
            client.post("/rooms/" + owner["pairing_code"] + "/join").status_code == 409
        )
        assert (
            client.delete(
                "/rooms/" + owner["room"],
                headers={"Authorization": "Bearer " + owner["token"]},
            ).status_code
            == 200
        )
        assert (
            client.post("/rooms/" + owner["pairing_code"] + "/join").status_code == 404
        )


def test_expired_code_and_guess_rate_limit(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    with TestClient(create_app()) as client:
        owner = client.post("/rooms").json()
        with patch(
            "services.signaling.app.time.time", return_value=owner["code_expires"] + 1
        ):
            assert (
                client.post("/rooms/" + owner["pairing_code"] + "/join").status_code
                == 404
            )
        statuses = [client.post("/rooms/999999/join").status_code for _ in range(25)]
        assert 429 in statuses


def test_pending_code_receiver_cannot_get_turn_credentials(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    monkeypatch.setenv(
        "FLOWDROP_TURN_URLS", '["turn:relay.example.com:3478?transport=tcp"]'
    )
    monkeypatch.setenv("FLOWDROP_TURN_SECRET", "x" * 64)
    with TestClient(create_app()) as client:
        owner = client.post("/rooms").json()
        receiver = client.post("/rooms/" + owner["pairing_code"] + "/join").json()
        pending = client.get(
            "/ice", headers={"Authorization": "Bearer " + receiver["token"]}
        ).json()
        assert pending["pendingApproval"] is True
        assert not any("credential" in server for server in pending["iceServers"])
        allowed = client.get(
            "/ice", headers={"Authorization": "Bearer " + owner["token"]}
        ).json()
        assert any("credential" in server for server in allowed["iceServers"])
