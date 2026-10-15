"""Portable host launcher. The capability is delivered via fragment, never HTTP logs."""

import argparse
import json
import secrets
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

from apps.desktop.diagnostics import bind_listeners, readiness
from apps.desktop.network import inventory_json, lan_adapters, startup_network
from services.lan_server.app import create_app
from services.online_config import OnlineService
from services.version import BUILD_ID, VERSION


def main(argv=None, on_ready=None):
    class Parser(argparse.ArgumentParser):
        def error(self, message):
            if on_ready is not None:
                raise ValueError(message)
            super().error(message)

    parser = Parser(description="FlowDrop private LAN host")
    parser.add_argument(
        "--version", action="version", version=f"FlowDrop {VERSION} ({BUILD_ID})"
    )
    parser.add_argument(
        "--shutdown-after",
        type=int,
        help="Stop gracefully after this many seconds (diagnostic runs)",
    )
    parser.add_argument(
        "--bind",
        default=None,
        help="Explicit local IPv4 adapter (enables LAN); 0.0.0.0 requires --lan",
    )
    parser.add_argument(
        "--lan",
        action="store_true",
        help="Enable Offline LAN on an active Wi-Fi/Ethernet IPv4 adapter",
    )
    parser.add_argument(
        "--online-url", help="Public HTTPS FlowDrop website (online handoff)"
    )
    parser.add_argument(
        "--signal-url",
        help="Public HTTPS signaling endpoint; defaults to website/signal",
    )
    parser.add_argument(
        "--online-dev",
        action="store_true",
        help="Explicit localhost-only online development configuration",
    )
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--list-adapters", action="store_true")
    parser.add_argument(
        "--build-info",
        action="store_true",
        help="Print version, build ID and executable path",
    )
    parser.add_argument(
        "--panel-smoke",
        action="store_true",
        help="Run automated native panel lifecycle diagnostics",
    )
    parser.add_argument(
        "--gui", action="store_true", help="Open the desktop host control panel"
    )
    parser.add_argument(
        "--tls-cert", help="Trusted TLS certificate PEM file for untrusted networks"
    )
    parser.add_argument("--tls-key", help="TLS private key PEM file")
    args = parser.parse_args(argv)
    import os

    if args.online_url is not None:
        os.environ["FLOWDROP_ONLINE_URL"] = args.online_url
    if args.signal_url is not None:
        os.environ["FLOWDROP_SIGNAL_URL"] = args.signal_url
    if args.online_dev:
        os.environ["FLOWDROP_ONLINE_DEV"] = "1"
    if not 0 <= args.port <= 65535:
        parser.error("Port must be between 0 and 65535")
    if args.shutdown_after is not None and not 1 <= args.shutdown_after <= 86400:
        parser.error("Shutdown delay must be between 1 and 86400 seconds")
    if args.build_info:
        print(
            json.dumps(
                {
                    "version": VERSION,
                    "build": BUILD_ID,
                    "executable": sys.executable,
                    "frozen": bool(getattr(sys, "frozen", False)),
                }
            )
        )
        return
    if args.panel_smoke:
        from apps.desktop.panel import panel_smoke

        panel_smoke()
        return
    if args.gui or (argv is None and len(sys.argv) == 1):
        from apps.desktop.panel import run_panel

        run_panel()
        return
    if bool(args.tls_cert) != bool(args.tls_key):
        parser.error("Provide both --tls-cert and --tls-key")
    import ipaddress

    if args.list_adapters:
        print(json.dumps(inventory_json(), indent=2))
        return

    try:
        bind, advertised = startup_network(args.lan, args.bind)
    except ValueError as exc:
        parser.error(str(exc))
    address = ipaddress.ip_address(advertised)
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
    try:
        sockets, port = bind_listeners(bind, args.port)
    except OSError as exc:
        parser.error(
            f"Cannot bind {bind}:{args.port}: {exc}. Refresh the adapter or inspect port listeners; no localhost fallback occurred."
        )
    scheme = "https" if args.tls_cert else "http"
    base = f"{scheme}://{advertised}:{port}"
    host_url = f"{scheme}://127.0.0.1:{port}"
    allowed_hosts = [advertised, "127.0.0.1", "localhost"]
    mdns_host = f"flowdrop-{secrets.token_hex(4)}.local"
    if not address.is_loopback:
        allowed_hosts.append(mdns_host)
    if bind == "0.0.0.0":
        allowed_hosts += ["127.0.0.1", "localhost"] + [ip for _, ip in lan_adapters()]
    elif address.is_loopback:
        allowed_hosts += ["localhost"]
    app = create_app(
        storage=data,
        host_token=token,
        connection_url=base if not address.is_loopback else None,
        allowed_hosts=allowed_hosts,
        lan_enabled=not address.is_loopback,
        online_service=OnlineService(),
    )
    app.state.host_dashboard_url = host_url
    app.state.connection_url = base if not address.is_loopback else None
    app.state.bind_address = bind
    app.state.port = port
    app.state.build_id = BUILD_ID
    if port != args.port and args.port:
        print(
            f"Port {args.port} occupied; selected available port {port} for both host and LAN."
        )
    if not args.tls_cert:
        print("FlowDrop: use a trusted private LAN. HTTP traffic is not encrypted.")
    print("Pairing code:", app.state.pairing_code)
    print(
        "Listening addresses:",
        ", ".join(f"{sock.getsockname()[0]}:{port}" for sock in sockets),
    )
    print("Host Dashboard URL:", host_url)
    print(
        "Offline LAN:",
        "disabled (this PC only)"
        if address.is_loopback
        else "enabled; pairing and host approval required",
    )
    print(
        "Connection URL:",
        base if not address.is_loopback else "Disabled (This PC Only)",
        flush=True,
    )
    server = uvicorn.Server(
        uvicorn.Config(
            app,
            log_level="warning",
            ssl_certfile=args.tls_cert,
            ssl_keyfile=args.tls_key,
            ws_max_size=131072,
            limit_concurrency=256,
            timeout_graceful_shutdown=10,
            proxy_headers=False,
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
                    try:
                        readiness(host_url, token)
                        webbrowser.open(host_url + "/#host=" + token)
                        return
                    except (OSError, ValueError, RuntimeError):
                        pass
                time.sleep(0.1)
            print(
                "Dashboard not opened: HTTP/frontend readiness failed. Run desktop diagnostics."
            )

        threading.Thread(target=open_when_ready, daemon=True).start()
    zeroconf = None
    if not address.is_loopback:
        try:
            from zeroconf import ServiceInfo, Zeroconf

            zeroconf = Zeroconf(interfaces=[advertised])
            service = ServiceInfo(
                "_flowdrop._tcp.local.",
                "FlowDrop._flowdrop._tcp.local.",
                addresses=[socket.inet_aton(advertised)],
                port=port,
                properties={"path": "/", "version": VERSION},
                server=mdns_host + ".",
            )
            zeroconf.register_service(service, allow_name_change=True)
        except (OSError, RuntimeError) as exc:
            print("mDNS unavailable; use the connection URL:", exc)
    try:
        server.run(sockets=sockets)
    finally:
        if zeroconf:
            zeroconf.close()
        for sock in sockets:
            sock.close()


if __name__ == "__main__":
    main()
