import base64
import hashlib
import hmac
import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from services.lan_server.app import create_app
from services.online_config import UNCONFIGURED, OnlineService, endpoint
from services.signaling.ice import ice_configuration


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com",
        "https://127.0.0.1",
        "https://192.168.1.7",
        "https://172.20.176.1",
        "https://host.local",
        "https://user:secret@example.com",
        "https://example.com/?token=x",
        "https://example.com/#secret",
    ],
)
def test_online_endpoint_rejects_insecure_or_lan_targets(url):
    with pytest.raises(ValueError):
        endpoint(url)


def test_local_online_development_is_explicit_and_loopback_only():
    assert endpoint("http://127.0.0.1:8765", dev=True) == "http://127.0.0.1:8765"
    with pytest.raises(ValueError):
        endpoint("http://192.168.1.7:8765", dev=True)
    assert (
        endpoint("https://share.example.com/signal/")
        == "https://share.example.com/signal"
    )


def test_desktop_unconfigured_health_and_host_only_settings(tmp_path, monkeypatch):
    monkeypatch.delenv("FLOWDROP_ONLINE_URL", raising=False)
    monkeypatch.delenv("FLOWDROP_SIGNAL_URL", raising=False)
    service = OnlineService(tmp_path / "online.json")
    with TestClient(
        create_app(tmp_path / "lan", "owner", online_service=service)
    ) as client:
        assert client.get("/api/online/config").json()["message"] == UNCONFIGURED
        assert client.get("/signal/health").status_code == 404
        assert client.get("/api/health").status_code == 200
        body = {
            "website": "https://share.example.com",
            "signaling": "https://signal.example.com",
        }
        assert client.post("/api/online/config", json=body).status_code == 401
        assert (
            client.post(
                "/api/online/config",
                json={"website": "http://192.168.1.7"},
                headers={"Authorization": "Bearer owner"},
            ).status_code
            == 400
        )
        assert (
            client.post(
                "/api/online/config",
                json=body,
                headers={"Authorization": "Bearer owner"},
            ).status_code
            == 200
        )
        with patch(
            "services.online_config.check_service",
            return_value={"status": "ok", "service": "signaling"},
        ) as probe:
            assert client.get("/api/online/config").json()["available"] is True
            client.get("/api/online/config")
            assert probe.call_count == 1
        assert json.loads((tmp_path / "online.json").read_text()) == body


def test_online_failure_does_not_disable_lan(tmp_path, monkeypatch):
    monkeypatch.setenv("FLOWDROP_ONLINE_URL", "https://share.example.com")
    service = OnlineService(tmp_path / "none.json")
    with patch("services.online_config.check_service", side_effect=OSError("offline")):
        assert service.status()["available"] is False
        assert "unavailable" in service.status()["message"]
    with TestClient(
        create_app(tmp_path / "lan", "owner", online_service=service)
    ) as client:
        assert client.get("/api/health").status_code == 200


def test_turn_multi_transport_short_lived_credentials(monkeypatch):
    secret = "secret-" + "x" * 40
    monkeypatch.setenv("FLOWDROP_STUN_URLS", '["stun:stun.example.com:3478"]')
    monkeypatch.setenv(
        "FLOWDROP_TURN_URLS",
        '["turn:turn.example.com:3478?transport=udp","turn:turn.example.com:3478?transport=tcp","turns:turn.example.com:5349?transport=tcp"]',
    )
    monkeypatch.setenv("FLOWDROP_TURN_SECRET", secret)
    monkeypatch.setenv("FLOWDROP_ICE_POLICY", "relay")
    with patch("services.signaling.ice.time.time", return_value=1000):
        config = ice_configuration()
    assert config["iceTransportPolicy"] == "relay"
    turn = config["iceServers"][1]
    assert turn["username"].startswith("1600:")
    assert len(turn["urls"]) == 3
    assert (
        turn["credential"]
        == base64.b64encode(
            hmac.new(secret.encode(), turn["username"].encode(), hashlib.sha1).digest()
        ).decode()
    )
    assert secret not in json.dumps(config)


def test_relay_only_without_turn_fails_clearly(monkeypatch):
    for key in ("FLOWDROP_TURN_URL", "FLOWDROP_TURN_URLS", "FLOWDROP_TURN_SECRET"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("FLOWDROP_ICE_POLICY", "relay")
    with pytest.raises(ValueError, match="Relay-only"):
        ice_configuration()


def test_busy_online_probe_does_not_block_lan_worker(tmp_path, monkeypatch):
    monkeypatch.delenv("FLOWDROP_ONLINE_URL", raising=False)
    service = OnlineService(tmp_path / "online.json")
    service.lock.acquire()
    try:
        assert service.status()["available"] is False
        assert "retry" in service.status()["message"]
    finally:
        service.lock.release()


def test_corrupt_saved_configuration_does_not_break_startup(tmp_path, monkeypatch):
    monkeypatch.delenv("FLOWDROP_ONLINE_URL", raising=False)
    path = tmp_path / "online.json"
    path.write_text("[]")
    assert OnlineService(path).status()["message"] == UNCONFIGURED


@pytest.mark.parametrize(
    "value",
    [
        "stun:",
        "https://stun.example.com",
        "turn:host:99999",
        "turn:host/path",
        "turn:host?secret=value",
        "stun:host?transport=",
    ],
)
def test_invalid_ice_configuration_fails_at_service_start(value, monkeypatch):
    monkeypatch.setenv("FLOWDROP_STUN_URLS", json.dumps([value]))
    with pytest.raises(ValueError):
        ice_configuration()


def test_turn_credentials_require_room_and_health_never_discloses_them(monkeypatch):
    from services.signaling.app import create_app as create_signal

    monkeypatch.setenv(
        "FLOWDROP_TURN_URLS", '["turn:turn.example.com:3478?transport=tcp"]'
    )
    monkeypatch.setenv("FLOWDROP_TURN_SECRET", "x" * 64)
    with TestClient(create_signal()) as client:
        assert "credential" not in client.get("/health").text
        assert client.get("/ice").status_code == 401
        owner = client.post("/rooms").json()
        response = client.get(
            "/ice", headers={"Authorization": "Bearer " + owner["token"]}
        )
        assert response.headers["Cache-Control"] == "no-store"
        config = response.json()
        assert config["turnConfigured"] is True
        assert config["iceServers"][0]["credential"]
