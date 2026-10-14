import socket
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from apps.desktop.network import lan_adapters, startup_network
from services.lan_server.app import create_app


def test_adapter_detection_filters_down_link_local_and_virtual_priority():
    values = {
        "vEthernet (WSL)": "172.20.176.1",
        "Wi-Fi": "192.168.43.105",
        "Ethernet": "169.254.1.2",
        "Disconnected": "10.0.0.2",
        "Loopback": "127.0.0.1",
    }
    with (
        patch(
            "apps.desktop.network.psutil.net_if_addrs",
            return_value={
                name: [SimpleNamespace(family=socket.AF_INET, address=ip)]
                for name, ip in values.items()
            },
        ),
        patch(
            "apps.desktop.network.psutil.net_if_stats",
            return_value={
                name: SimpleNamespace(isup=name != "Disconnected") for name in values
            },
        ),
    ):
        assert lan_adapters() == [
            ("Wi-Fi", "192.168.43.105"),
            ("vEthernet (WSL)", "172.20.176.1"),
        ]


@pytest.mark.parametrize(
    "lan,bind,expected",
    [
        (False, None, ("127.0.0.1", "127.0.0.1")),
        (True, None, ("192.168.43.105", "192.168.43.105")),
        (False, "192.168.43.105", ("192.168.43.105", "192.168.43.105")),
        (True, "0.0.0.0", ("0.0.0.0", "192.168.43.105")),
    ],
)
def test_startup_modes(lan, bind, expected):
    with patch(
        "apps.desktop.network.lan_adapters", return_value=[("Wi-Fi", "192.168.43.105")]
    ):
        assert startup_network(lan, bind) == expected


@pytest.mark.parametrize(
    "lan,bind",
    [
        (False, "0.0.0.0"),
        (True, "127.0.0.1"),
        (True, "8.8.8.8"),
        (True, "192.168.1.99"),
    ],
)
def test_invalid_startup_modes(lan, bind):
    with (
        patch(
            "apps.desktop.network.lan_adapters",
            return_value=[("Wi-Fi", "192.168.43.105")],
        ),
        pytest.raises(ValueError),
    ):
        startup_network(lan, bind)


def test_lan_without_adapter_fails_closed():
    with patch("apps.desktop.network.lan_adapters", return_value=[]):
        with pytest.raises(ValueError):
            startup_network(True)
        assert startup_network() == ("127.0.0.1", "127.0.0.1")


def test_lan_host_origin_and_pairing_authorization(tmp_path):
    base = "http://192.168.43.105:8000"
    app = create_app(
        tmp_path,
        "owner",
        connection_url=base,
        allowed_hosts=["192.168.43.105", "flowdrop-test.local"],
    )
    with TestClient(app, base_url=base) as client:
        assert client.get("/api/health").status_code == 200
        assert (
            client.get(
                "/api/health", headers={"Host": "flowdrop-test.local"}
            ).status_code
            == 200
        )
        assert (
            client.get("/api/health", headers={"Host": "evil.example"}).status_code
            == 400
        )
        assert client.get("/api/transfers").status_code == 401
        owner = {"Authorization": "Bearer owner"}
        session = client.get("/api/session", headers=owner).json()
        assert session["connection_url"] == base
        assert (
            client.post(
                "/api/pair",
                json={"code": session["pairing_code"], "name": "Phone"},
                headers={"Origin": "http://evil.example"},
            ).status_code
            == 403
        )
        paired = client.post(
            "/api/pair",
            json={"code": session["pairing_code"], "name": "Phone"},
            headers={"Origin": base},
        ).json()
        guest = {"Authorization": "Bearer " + paired["token"]}
        assert client.get("/api/transfers", headers=guest).status_code == 401
        assert (
            client.post(
                f"/api/devices/{paired['id']}/approve", headers=owner
            ).status_code
            == 200
        )
        assert client.get("/api/transfers", headers=guest).status_code == 200
        assert (
            client.get("/api/session", headers=guest).json()["connection_url"] is None
        )
        with client.websocket_connect(
            base.replace("http://", "ws://") + "/api/ws", headers={"Origin": base}
        ) as ws:
            ws.send_text(paired["token"])
            ws.send_json({"type": "text", "recipient": "host", "text": "LAN"})
