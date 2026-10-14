"""Local-only readiness checks and bounded socket startup."""

import errno
import json
import os
import socket
import urllib.request
from urllib.parse import urlsplit

import psutil
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect


def bind_listeners(address, port):
    for attempt in range(6):
        sockets = []
        try:
            primary = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sockets.append(primary)
            primary.bind((address, port if attempt == 0 else 0))
            actual = primary.getsockname()[1]
            if address not in ("127.0.0.1", "0.0.0.0"):
                local = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sockets.append(local)
                local.bind(("127.0.0.1", actual))
            return sockets, actual
        except OSError as exc:
            for sock in sockets:
                sock.close()
            if (
                exc.errno not in (errno.EADDRINUSE, 10048)
                and getattr(exc, "winerror", None) != 10048
            ):
                raise
            if attempt == 5:
                raise OSError(
                    "No port available for both loopback and LAN; retry after inspecting listeners"
                ) from exc
    raise AssertionError("unreachable")


def read_url(url, token=None):
    headers = {"Authorization": "Bearer " + token} if token else {}
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(
        urllib.request.Request(url, headers=headers), timeout=2
    ) as response:
        return response.read(262144)


def readiness(base, token):
    health = json.loads(read_url(base + "/api/health"))
    if health.get("status") != "ok":
        raise RuntimeError("Health endpoint did not report ok")
    session = json.loads(read_url(base + "/api/session", token))
    if session.get("id") != "host":
        raise RuntimeError("Readiness did not authenticate this host process")
    if b"FlowDrop" not in read_url(base + "/"):
        raise RuntimeError("Compiled frontend is missing; rebuild the portable bundle")
    return health


def run_diagnostics(host_url, lan_url, token, bind, port):
    result = {
        "Host Dashboard URL": host_url,
        "Phone URL": lan_url or "Disabled",
        "Phone connectivity": "Not verified — local checks cannot establish phone reachability",
    }
    try:
        readiness(host_url, token)
        result["Local HTTP / frontend / authorization"] = "Passed"
    except (OSError, ValueError, RuntimeError) as exc:
        result["Local HTTP / frontend / authorization"] = "Failed: " + str(exc)
    if lan_url:
        try:
            readiness(lan_url, token)
            result["LAN IP HTTP (same PC)"] = "Passed; physical phone not verified"
        except (OSError, ValueError, RuntimeError) as exc:
            result["LAN IP HTTP (same PC)"] = "Failed: " + str(exc)
    try:
        listeners = [
            (c.laddr.ip, c.laddr.port)
            for c in psutil.Process(os.getpid()).net_connections(kind="tcp4")
            if c.status == psutil.CONN_LISTEN
        ]
        result["Socket check"] = (
            "Passed"
            if (bind, port) in listeners
            and (bind == "0.0.0.0" or ("127.0.0.1", port) in listeners)
            else "Expected listener missing"
        )
    except (OSError, psutil.Error) as exc:
        result["Socket check"] = "Unavailable: " + str(exc)
    try:
        with connect(
            host_url.replace("http://", "ws://").replace("https://", "wss://")
            + "/api/ws",
            origin=host_url,
            proxy=None,
            open_timeout=2,
        ) as ws:
            ws.send("diagnostic-invalid-capability")
            try:
                ws.recv(timeout=2)
                result["WebSocket authorization"] = (
                    "Failed: invalid capability accepted"
                )
            except ConnectionClosed as exc:
                result["WebSocket authorization"] = (
                    "Passed: denied (1008)"
                    if exc.rcvd and exc.rcvd.code == 1008
                    else "Unexpected close"
                )
    except (OSError, TimeoutError, RuntimeError) as exc:
        result["WebSocket authorization"] = "Failed: " + str(exc)
    result["URL check"] = (
        "Passed"
        if not lan_url or urlsplit(lan_url).hostname == bind or bind == "0.0.0.0"
        else "Address mismatch"
    )
    return result
