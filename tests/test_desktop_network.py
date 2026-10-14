import errno
import json
import socket
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from apps.desktop.diagnostics import bind_listeners, readiness
from apps.desktop.firewall import ps_literal, rule_name, rule_script
from apps.desktop.launcher import main
from apps.desktop.network import (
    Adapter,
    automatic_candidates,
    choose_adapter,
    discover_adapters,
    load_preference,
    save_preference,
    startup_network,
)
from services.lan_server.app import create_app
from services.version import BUILD_ID

WIFI = Adapter(
    "Wi-Fi",
    "192.168.1.7",
    index=18,
    gateway="192.168.1.1",
    physical=True,
    profile="Private",
    metric=30,
    guid="wifi-guid",
)
OBSERVED = [
    Adapter("vEthernet (WSL Hyper-V)", "172.20.176.1", virtual=True),
    Adapter("Local Area Connection* 4", "192.168.137.1", virtual=True),
    Adapter("Local Area Connection* 3", "169.254.144.252", virtual=True),
    Adapter("Ethernet", "169.254.99.8", up=False, physical=True),
    WIFI,
]


def test_physical_selection_in_observed_windows_environment():
    assert choose_adapter(OBSERVED) == WIFI
    assert automatic_candidates(OBSERVED) == [WIFI]
    assert WIFI.subnet == "192.168.1.0/24"


@pytest.mark.parametrize(
    "name",
    [
        "WSL",
        "vEthernet",
        "Hyper-V",
        "Docker",
        "VMware",
        "VirtualBox",
        "Local Area Connection* 4",
    ],
)
def test_virtual_exclusion_even_with_misleading_hardware_flag(name):
    adapter = Adapter(name, "172.20.176.1", physical=True)
    assert not automatic_candidates([adapter])


def test_ambiguity_requires_selection_and_remembered_identity_is_validated():
    ethernet = Adapter("Ethernet", "10.0.0.2", physical=True, guid="wired")
    with pytest.raises(ValueError, match="Multiple"):
        choose_adapter([WIFI, ethernet])
    assert choose_adapter([WIFI, ethernet], "wired") == ethernet
    with pytest.raises(ValueError, match="No active"):
        choose_adapter([replace(WIFI, up=False)], WIFI.identity)
    changed = replace(WIFI, ipv4="192.168.43.105")
    assert choose_adapter([changed], WIFI.identity).ipv4 == "192.168.43.105"
    assert not automatic_candidates([replace(WIFI, local_route=False)])


@pytest.mark.parametrize(
    "lan,bind,expected",
    [
        (False, None, ("127.0.0.1", "127.0.0.1")),
        (True, None, ("192.168.1.7", "192.168.1.7")),
        (True, "192.168.1.7", ("192.168.1.7", "192.168.1.7")),
        (False, "172.20.176.1", ("172.20.176.1", "172.20.176.1")),
        (True, "0.0.0.0", ("0.0.0.0", "192.168.1.7")),
    ],
)
def test_startup_modes(lan, bind, expected):
    with patch("apps.desktop.network.discover_adapters", return_value=OBSERVED):
        assert startup_network(lan, bind) == expected


@pytest.mark.parametrize(
    "lan,bind",
    [
        (False, "0.0.0.0"),
        (True, "127.0.0.1"),
        (True, "8.8.8.8"),
        (True, "192.168.1.99"),
        (True, "bad"),
    ],
)
def test_invalid_startup_modes(lan, bind):
    with (
        patch("apps.desktop.network.discover_adapters", return_value=OBSERVED),
        pytest.raises(ValueError),
    ):
        startup_network(lan, bind)


@pytest.mark.parametrize("profile", ["Public", "Unknown"])
def test_no_automatic_public_exposure_or_virtual_fallback(profile):
    with patch(
        "apps.desktop.network.discover_adapters",
        return_value=[replace(WIFI, profile=profile)],
    ):
        with pytest.raises(ValueError, match=profile):
            startup_network(True)
        assert startup_network(True, WIFI.ipv4) == (WIFI.ipv4, WIFI.ipv4)
    with (
        patch("apps.desktop.network.discover_adapters", return_value=OBSERVED[:-1]),
        pytest.raises(ValueError),
    ):
        startup_network(True)
    assert startup_network() == ("127.0.0.1", "127.0.0.1")


def test_preference_remembers_identity_not_ip_or_lan_consent(tmp_path):
    path = tmp_path / "network.json"
    save_preference(WIFI, path)
    assert load_preference(path) == WIFI.identity
    assert json.loads(path.read_text()) == {"adapter": "wifi-guid"}
    path.write_text("bad")
    assert load_preference(path) is None


def test_windows_inventory_keeps_route_and_profile_metadata():
    with (
        patch("apps.desktop.network.windows_inventory", return_value=OBSERVED),
        patch("apps.desktop.network.os", SimpleNamespace(name="nt")),
    ):
        adapters = discover_adapters()
    assert adapters[0] == WIFI
    assert adapters[0].index == 18
    assert adapters[0].gateway == "192.168.1.1"


def test_port_collision_recovery_and_release():
    with socket.socket() as occupied:
        occupied.bind(("127.0.0.1", 0))
        occupied.listen()
        port = occupied.getsockname()[1]
        sockets, actual = bind_listeners("127.0.0.1", port)
        assert actual != port
        for sock in sockets:
            sock.close()
        sockets, reused = bind_listeners("127.0.0.1", actual)
        assert reused == actual
        for sock in sockets:
            sock.close()


def test_invalid_bind_does_not_fallback():
    with patch("apps.desktop.diagnostics.socket.socket") as factory:
        factory.return_value.bind.side_effect = OSError(
            errno.EADDRNOTAVAIL, "adapter disappeared"
        )
        with pytest.raises(OSError, match="disappeared"):
            bind_listeners("192.168.1.7", 8000)
        factory.return_value.close.assert_called_once()


def test_cli_help_and_build_identity(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["--help"])
    assert exc.value.code == 0
    assert "--lan" in capsys.readouterr().out
    with pytest.raises(SystemExit):
        main(["--version"])
    assert BUILD_ID in capsys.readouterr().out


def test_readiness_requires_own_auth_and_frontend():
    with patch(
        "apps.desktop.diagnostics.read_url",
        side_effect=[b'{"status":"ok"}', b'{"id":"host"}', b"FlowDrop frontend"],
    ):
        assert readiness("http://127.0.0.1:8000", "owner")["status"] == "ok"
    with (
        patch(
            "apps.desktop.diagnostics.read_url",
            side_effect=[b'{"status":"ok"}', b'{"id":"host"}', b"missing"],
        ),
        pytest.raises(RuntimeError, match="frontend"),
    ):
        readiness("http://127.0.0.1:8000", "owner")
    with (
        patch(
            "apps.desktop.diagnostics.read_url",
            side_effect=[b'{"status":"ok"}', b'{"id":"someone"}'],
        ),
        pytest.raises(RuntimeError, match="authenticate"),
    ):
        readiness("http://127.0.0.1:8000", "owner")


def test_firewall_rule_is_narrow_idempotent_and_quotes_paths():
    script = rule_script("C:/Flow Drop/O'Neil/FlowDrop.exe", 6918, WIFI.ipv4)
    assert "-Profile Private -RemoteAddress LocalSubnet" in script
    assert "-LocalAddress '192.168.1.7'" in script
    assert "-Protocol TCP -LocalPort 6918" in script
    assert "if($existing)" in script
    assert "Set-NetConnectionProfile" not in script
    assert "Public" not in script
    assert ps_literal("O'Neil") == "'O''Neil'"
    assert rule_name("C:/FlowDrop.exe", 8000, WIFI.ipv4) == rule_name(
        "C:/FlowDrop.exe", 8000, WIFI.ipv4
    )


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
