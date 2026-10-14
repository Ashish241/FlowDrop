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

from apps.desktop.network import choose_adapter, discover_adapters


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", default="dist/FlowDrop/FlowDrop.exe")
    args = parser.parse_args()
    executable = str(Path(args.exe).resolve())
    selected = choose_adapter(discover_adapters())
    advertised = selected.ipv4
    records = []
    modes = [
        ("loopback", [], "127.0.0.1", "127.0.0.1"),
        ("lan-selected", ["--lan", "--bind", advertised], advertised, advertised),
        ("lan-all", ["--lan", "--bind", "0.0.0.0"], "0.0.0.0", advertised),
    ]
    if selected.profile != "Private":
        done = subprocess.run(
            [executable, "--lan", "--no-browser", "--shutdown-after", "1"],
            check=False,
            capture_output=True,
            text=True,
            timeout=25,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        assert done.returncode == 2 and selected.profile in done.stderr
        records.append(
            {
                "mode": "lan-auto-public",
                "result": "correctly requires explicit trusted-network selection; no silent exposure",
            }
        )
    else:
        modes.append(("lan-auto", ["--lan"], advertised, advertised))
    for mode, flags, expected, host in modes:
        with tempfile.TemporaryDirectory(prefix="flowdrop-network-") as directory:
            env = dict(os.environ, FLOWDROP_STORAGE=directory)
            output = Path(directory) / "process.log"
            with output.open("w", encoding="utf-8") as log:
                process = subprocess.Popen(
                    [
                        executable,
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
                    deadline = time.monotonic() + 45
                    while time.monotonic() < deadline:
                        if process.poll() is not None:
                            raise RuntimeError("Executable exited before listening")
                        listeners = [
                            c
                            for c in psutil.Process(process.pid).net_connections(
                                kind="tcp4"
                            )
                            if c.status == psutil.CONN_LISTEN
                        ]
                        matches = [c for c in listeners if c.laddr.ip == expected]
                        if matches:
                            listener = matches[0].laddr
                            if expected not in ("0.0.0.0", "127.0.0.1"):
                                assert any(
                                    c.laddr.ip == "127.0.0.1"
                                    and c.laddr.port == listener.port
                                    for c in listeners
                                )
                            break
                        time.sleep(0.1)
                    if not listener:
                        log.flush()
                        failure = Path(".flowdrop") / (
                            "network-failure-" + mode + ".log"
                        )
                        failure.parent.mkdir(exist_ok=True)
                        failure.write_text(
                            output.read_text(encoding="utf-8"), encoding="utf-8"
                        )
                        raise RuntimeError(
                            f"No {expected} listener before bounded startup deadline; see {failure}"
                        )
                    assert listener.ip == expected, listener
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
                    with httpx.Client(trust_env=False, timeout=5) as local:
                        assert (
                            local.get(
                                f"http://127.0.0.1:{listener.port}/api/health"
                            ).status_code
                            == 200
                        )
                    assert process.wait(timeout=25) == 0
                finally:
                    if process.poll() is None:
                        process.terminate()
                        process.wait(timeout=10)
            text = output.read_text(encoding="utf-8")
            assert f"Host Dashboard URL: http://127.0.0.1:{listener.port}" in text
            assert (
                ("Connection URL: " + base in text)
                if mode != "loopback"
                else ("Connection URL: Disabled" in text)
            )
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
