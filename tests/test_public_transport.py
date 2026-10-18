"""Actual TCP close-frame regression for the mounted public ASGI target."""

import json
import socket
import threading
import time

import httpx
import pytest
import uvicorn
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect

from services.signaling.public import create_app


@pytest.mark.parametrize("transport", ["auto", "websockets"])
def test_public_server_initiated_removal_close_on_real_tcp(monkeypatch, transport):
    origin = "https://frontend.example.com"
    monkeypatch.setenv("FLOWDROP_ORIGINS", origin)
    monkeypatch.delenv("REDIS_URL", raising=False)
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    server = uvicorn.Server(
        uvicorn.Config(
            create_app(), ws=transport, access_log=False, log_level="warning"
        )
    )
    thread = threading.Thread(
        target=server.run, kwargs={"sockets": [listener]}, daemon=True
    )
    thread.start()
    try:
        deadline = time.monotonic() + 10
        while not server.started:
            assert thread.is_alive() and time.monotonic() < deadline
            time.sleep(0.01)
        base = f"http://127.0.0.1:{port}/signal/v2"
        with httpx.Client(
            trust_env=False, timeout=15, headers={"Origin": origin}
        ) as client:
            response = client.post(base + "/rooms", json={"name": "Host"})
            response.raise_for_status()
            host = response.json()
            path = base + "/rooms/" + host["room"]
            auth = {"Authorization": "Bearer " + host["token"]}
            try:
                response = client.post(
                    base + "/rooms/" + host["code"] + "/join", json={"name": "Peer"}
                )
                response.raise_for_status()
                peer = response.json()
                url = path.replace("http:", "ws:") + "/ws"
                with connect(url, origin=origin, proxy=None) as ws:
                    ws.send(peer["token"])
                    assert json.loads(ws.recv(timeout=5))["type"] == "members"
                    response = client.delete(
                        path + "/members/" + peer["member"], headers=auth
                    )
                    response.raise_for_status()
                    assert json.loads(ws.recv(timeout=5))["type"] == "removed"
                    with pytest.raises(ConnectionClosed) as closed:
                        ws.recv(timeout=5)
                    assert closed.value.rcvd is not None
                    assert closed.value.rcvd.code == 4003
                    assert (
                        client.get(
                            path + "/ice",
                            headers={"Authorization": "Bearer " + peer["token"]},
                        ).status_code
                        == 403
                    )
            finally:
                assert (
                    client.delete(path + "/membership", headers=auth).status_code == 200
                )
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        listener.close()
        assert not thread.is_alive()


@pytest.mark.parametrize("fail", [False, True])
def test_close_audit_never_logs_frame_or_exception_contents(caplog, fail):
    import asyncio
    import logging

    from services.signaling.public import CloseFrameAudit

    secret = "private-token-and-room-payload"

    async def app(scope, receive, send):
        await send({"type": "websocket.close", "code": 4003, "reason": secret})

    async def send(message):
        if fail:
            raise RuntimeError(secret)

    caplog.set_level(logging.INFO, logger="uvicorn.error")
    if fail:
        with pytest.raises(RuntimeError):
            asyncio.run(CloseFrameAudit(app)({"type": "websocket"}, None, send))
    else:
        asyncio.run(CloseFrameAudit(app)({"type": "websocket"}, None, send))
    assert "code=4003" in caplog.text
    assert ("close failed" if fail else "close completed") in caplog.text
    assert secret not in caplog.text
