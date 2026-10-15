import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from services.signaling.public import create_app


def test_public_target_requires_exact_https_origins(monkeypatch):
    for value in ("", "*", "http://example.com", "https://example.com/path"):
        monkeypatch.setenv("FLOWDROP_ORIGINS", value)
        with pytest.raises(ValueError):
            create_app()


def test_public_signaling_has_no_desktop_or_database_dependency(monkeypatch):
    monkeypatch.setenv("FLOWDROP_ORIGINS", "https://frontend.example.com")
    monkeypatch.delenv("REDIS_URL", raising=False)
    with TestClient(create_app()) as client:
        assert client.get("/signal/health").json()["service"] == "signaling"
        assert client.get("/api/health").status_code == 404
        assert client.get("/cloud/health").status_code == 404
        preflight = client.options(
            "/signal/rooms",
            headers={
                "Origin": "https://frontend.example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        assert preflight.status_code == 200
        assert (
            preflight.headers["access-control-allow-origin"]
            == "https://frontend.example.com"
        )
        assert (
            "access-control-allow-origin"
            not in client.get(
                "/signal/health", headers={"Origin": "https://evil.example"}
            ).headers
        )
        assert (
            client.post(
                "/signal/rooms", headers={"Origin": "https://evil.example"}
            ).status_code
            == 403
        )
        room = client.post(
            "/signal/rooms", headers={"Origin": "https://frontend.example.com"}
        ).json()
        assert len(room["room"]) == 32
        assert client.get("/signal/ice").status_code == 401
        with client.websocket_connect(
            "/signal/rooms/" + room["room"] + "/ws",
            headers={"Origin": "https://frontend.example.com"},
        ) as ws:
            ws.send_text("invalid")
            with pytest.raises(WebSocketDisconnect) as closed:
                ws.receive_json()
            assert closed.value.code == 1008
