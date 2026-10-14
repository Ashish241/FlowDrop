"""Portable host launcher. The capability is delivered via fragment, never HTTP logs."""

import argparse
import secrets
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

from services.lan_server.app import create_app
from services.version import VERSION


def main(argv=None, on_ready=None):
    parser = argparse.ArgumentParser(description="FlowDrop private LAN host")
    parser.add_argument("--version", action="version", version="FlowDrop " + VERSION)
    parser.add_argument(
        "--shutdown-after",
        type=int,
        help="Stop gracefully after this many seconds (diagnostic runs)",
    )
    parser.add_argument(
        "--bind",
        default="127.0.0.1",
        help="Explicit private adapter IPv4 address; default is loopback",
    )
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--list-adapters", action="store_true")
    parser.add_argument(
        "--gui", action="store_true", help="Open the desktop host control panel"
    )
    parser.add_argument(
        "--tls-cert", help="Trusted TLS certificate PEM file for untrusted networks"
    )
    parser.add_argument("--tls-key", help="TLS private key PEM file")
    args = parser.parse_args(argv)
    if not 0 <= args.port <= 65535:
        parser.error("Port must be between 0 and 65535")
    if args.shutdown_after is not None and not 1 <= args.shutdown_after <= 86400:
        parser.error("Shutdown delay must be between 1 and 86400 seconds")
    if args.gui or (argv is None and len(sys.argv) == 1):
        from apps.desktop.panel import run_panel

        run_panel()
        return
    if bool(args.tls_cert) != bool(args.tls_key):
        parser.error("Provide both --tls-cert and --tls-key")
    import ipaddress

    import psutil

    if args.list_adapters:
        for interface, addresses in psutil.net_if_addrs().items():
            for adapter in addresses:
                if (
                    adapter.family == socket.AF_INET
                    and ipaddress.ip_address(adapter.address).is_private
                ):
                    print(f"{interface}: {adapter.address}")
        return

    try:
        address = ipaddress.ip_address(args.bind)
    except ValueError:
        parser.error("Choose a valid private IPv4 address from --list-adapters")
    if address.version != 4 or not address.is_private or address.is_unspecified:
        parser.error("Choose an explicit private or loopback IPv4 adapter address")
    token = secrets.token_urlsafe(32)
    import os

    data = Path(
        os.getenv(
            "FLOWDROP_STORAGE",
            str(
                Path(os.getenv("LOCALAPPDATA", str(Path.home()))) / "FlowDrop" / "data"
            ),
        )
    )
    app = create_app(storage=data, host_token=token)
    sock = socket.socket()
    try:
        sock.bind((args.bind, args.port))
    except OSError as exc:
        parser.error(
            f"Cannot bind {args.bind}:{args.port}: {exc}. Choose a different --port or adapter."
        )
    if not args.tls_cert:
        print("FlowDrop: use a trusted private LAN. HTTP traffic is not encrypted.")
    print("Pairing code:", app.state.pairing_code)
    scheme = "https" if args.tls_cert else "http"
    base = f"{scheme}://{args.bind}:{sock.getsockname()[1]}"
    print("Connection URL:", base)
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            log_level="warning",
            ssl_certfile=args.tls_cert,
            ssl_keyfile=args.tls_key,
            ws_max_size=131072,
            limit_concurrency=256,
            timeout_graceful_shutdown=10,
        )
    )
    if on_ready:
        on_ready(app, server, base)
    if args.shutdown_after:

        def stop_when_ready():
            while not server.started and not server.should_exit:
                time.sleep(0.1)
            if not server.should_exit:
                time.sleep(args.shutdown_after)
                server.should_exit = True

        threading.Thread(target=stop_when_ready, daemon=True).start()
    if not args.no_browser:

        def open_when_ready():
            for _ in range(100):
                if server.should_exit:
                    return
                if server.started:
                    webbrowser.open(base + "/#host=" + token)
                    return
                time.sleep(0.1)

        threading.Thread(target=open_when_ready, daemon=True).start()
    zeroconf = None
    if not address.is_loopback:
        try:
            from zeroconf import ServiceInfo, Zeroconf

            zeroconf = Zeroconf(interfaces=[args.bind])
            service = ServiceInfo(
                "_flowdrop._tcp.local.",
                "FlowDrop._flowdrop._tcp.local.",
                addresses=[socket.inet_aton(args.bind)],
                port=sock.getsockname()[1],
                properties={"path": "/", "version": VERSION},
                server=f"flowdrop-{secrets.token_hex(4)}.local.",
            )
            zeroconf.register_service(service, allow_name_change=True)
        except (OSError, RuntimeError) as exc:
            print("mDNS unavailable; use the connection URL:", exc)
    try:
        server.run(sockets=[sock])
    finally:
        if zeroconf:
            zeroconf.close()
        sock.close()


if __name__ == "__main__":
    main()
