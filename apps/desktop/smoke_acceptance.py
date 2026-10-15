"""Packaged diagnostic fixture: local clients only, never physical-phone verification."""

import hashlib
import json
import urllib.request

from websockets.sync.client import connect


def verify_lan_transfer(app, host_url, lan_url):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(base, path, method="GET", token=None, data=None):
        headers = {"Origin": base}
        if token:
            headers["Authorization"] = "Bearer " + token
        body = json.dumps(data).encode() if isinstance(data, dict) else data
        if isinstance(data, dict):
            headers["Content-Type"] = "application/json"
        with opener.open(
            urllib.request.Request(
                base + path, data=body, method=method, headers=headers
            ),
            timeout=5,
        ) as response:
            return response.read()

    owner = app.state.host_token
    paired = json.loads(
        request(
            lan_url,
            "/api/pair",
            "POST",
            data={"code": app.state.pairing_code, "name": "Packaged local test client"},
        )
    )
    request(host_url, f"/api/devices/{paired['id']}/approve", "POST", owner, b"")
    payload = bytes(range(256)) * 1024
    offered = json.loads(
        request(
            host_url,
            "/api/transfers",
            "POST",
            owner,
            {
                "name": "packaged-check.bin",
                "size": len(payload),
                "recipient": paired["id"],
                "sha256": hashlib.sha256(payload).hexdigest(),
            },
        )
    )
    path = "/api/transfers/" + offered["id"]
    request(lan_url, path + "/accept", "POST", paired["token"], b"")
    request(host_url, path + "/chunks/0", "PUT", owner, payload)
    request(host_url, path + "/finish", "POST", owner, b"")
    assert request(lan_url, path + "/download", token=paired["token"]) == payload
    with connect(
        lan_url.replace("http://", "ws://") + "/api/ws", origin=lan_url, proxy=None
    ) as ws:
        ws.send(paired["token"])
        ws.send(
            json.dumps(
                {
                    "type": "text",
                    "recipient": paired["id"],
                    "text": "packaged local socket check",
                }
            )
        )
        received = json.loads(ws.recv(timeout=5))
        assert received["text"] == "packaged local socket check"
    request(host_url, "/api/devices/" + paired["id"], "DELETE", owner)
    return "Passed: 256 KiB hash-matched LAN download and authenticated WebSocket echo; clients on same PC"
