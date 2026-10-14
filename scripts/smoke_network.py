"""Verify actual executable TCP bindings; this is not a physical-device test."""

import argparse
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import httpx
import psutil
from websockets.exceptions import ConnectionClosed
from websockets.sync.client import connect

from apps.desktop.network import lan_adapters


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", default="dist/FlowDrop/FlowDrop.exe")
    args = parser.parse_args()
    adapters = lan_adapters()
    if not adapters:
        raise RuntimeError("LAN verification blocked: no active private IPv4 adapter")
    advertised = adapters[0][1]
    records = []
    for mode, flags, expected, host in [
        ("loopback", [], "127.0.0.1", "127.0.0.1"),
        ("lan-auto", ["--lan"], advertised, advertised),
        ("lan-selected", ["--lan", "--bind", advertised], advertised, advertised),
        ("lan-all", ["--lan", "--bind", "0.0.0.0"], "0.0.0.0", advertised),
    ]:
        with tempfile.TemporaryDirectory(prefix="flowdrop-network-") as directory:
            env = dict(os.environ, FLOWDROP_STORAGE=directory)
            output = Path(directory) / "process.log"
            with output.open("w", encoding="utf-8") as log:
                process = subprocess.Popen(
                    [
                        str(Path(args.exe).resolve()),
                        "--no-browser",
                        "--port",
                        "0",
                        "--shutdown-after",
                        "10",
                        *flags,
                    ],
                    stdout=log,
                    stderr=log,
                    env=env,
                    cwd=directory,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
                try:
                    listener = None
                    for _ in range(200):
                        if process.poll() is not None:
                            raise RuntimeError("Executable exited before listening")
                        listeners = [
                            c
                            for c in psutil.Process(process.pid).net_connections(
                                kind="tcp4"
                            )
                            if c.status == psutil.CONN_LISTEN
                        ]
                        if listeners:
                            listener = listeners[0].laddr
                            break
                        time.sleep(0.1)
                    assert listener and listener.ip == expected, listener
                    base = f"http://{host}:{listener.port}"
                    with httpx.Client(
                        base_url=base, trust_env=False, timeout=5
                    ) as client:
                        assert client.get("/api/health").status_code == 200
                        assert "FlowDrop" in client.get("/").text
                        assert client.get("/stream-sw.js").status_code == 200
                        assert client.get("/api/transfers").status_code == 401
                        assert (
                            client.get(
                                "/api/health", headers={"Host": "evil.example"}
                            ).status_code
                            == 400
                        )
                        assert (
                            client.get(
                                "/api/health", headers={"Origin": "http://evil.example"}
                            ).status_code
                            == 403
                        )
                    with connect(
                        base.replace("http://", "ws://") + "/api/ws",
                        origin=base,
                        proxy=None,
                    ) as ws:
                        ws.send("invalid-capability")
                        try:
                            ws.recv(timeout=3)
                            raise AssertionError(
                                "Unauthenticated socket was not closed"
                            )
                        except ConnectionClosed as exc:
                            assert exc.rcvd.code == 1008
                    assert process.wait(timeout=25) == 0
                finally:
                    if process.poll() is None:
                        process.terminate()
                        process.wait(timeout=10)
            assert "Connection URL: " + base in output.read_text(encoding="utf-8")
            records.append(
                {
                    "mode": mode,
                    "listening_address": listener.ip,
                    "port": listener.port,
                    "connection_url": base,
                    "http_frontend_ws_auth": "passed",
                }
            )
            print(json.dumps(records[-1]), flush=True)
    target = Path(".flowdrop/network-smoke.json")
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
