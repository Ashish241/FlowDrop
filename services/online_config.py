"""Explicit desktop-to-hosted-online configuration; no public dependency for LAN."""

import ipaddress
import json
import os
import threading
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

UNCONFIGURED = "Online Sharing is unavailable: signaling server not configured."


def endpoint(value, dev=False):
    value = value.strip().rstrip("/")
    parts = urlsplit(value)
    if (
        not parts.hostname
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
    ):
        raise ValueError(
            "Use an absolute HTTPS endpoint without credentials, query or fragment"
        )
    host = parts.hostname.lower()
    loopback = host == "localhost"
    try:
        address = ipaddress.ip_address(host)
        loopback = address.is_loopback
        if not address.is_global and not (dev and loopback):
            raise ValueError(
                "Online endpoints cannot use a LAN, private or virtual-adapter IP"
            )
    except ValueError as exc:
        if "Online endpoints" in str(exc):
            raise
        if host.endswith((".local", ".localhost")) or (
            "." not in host and not loopback
        ):
            raise ValueError(
                "Use a public DNS name, not a LAN adapter or local hostname"
            ) from exc
    if loopback and not dev:
        raise ValueError(
            "Loopback online services require explicit FLOWDROP_ONLINE_DEV=1 development mode"
        )
    if parts.scheme != "https" and not (dev and loopback and parts.scheme == "http"):
        raise ValueError(
            "Public online services require HTTPS; mixed-content HTTP is not supported"
        )
    if parts.port is not None and not 1 <= parts.port <= 65535:
        raise ValueError("Invalid online endpoint port")
    return urlunsplit(
        (parts.scheme, parts.netloc.lower(), parts.path.rstrip("/"), "", "")
    )


def settings_path():
    return Path(
        os.getenv(
            "FLOWDROP_ONLINE_CONFIG",
            str(
                Path(os.getenv("LOCALAPPDATA", str(Path.home())))
                / "FlowDrop"
                / "online.json"
            ),
        )
    )


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def check_service(website, signaling):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(signaling + "/health", timeout=3) as response:
        info = json.loads(response.read(16384))
    if (
        not isinstance(info, dict)
        or info.get("status") != "ok"
        or info.get("service") != "signaling"
    ):
        raise ValueError("Endpoint is not a healthy FlowDrop signaling service")
    if signaling != website + "/signal":
        with opener.open(website + "/signal/health", timeout=3) as response:
            proxy = json.loads(response.read(16384))
        if (
            not isinstance(proxy, dict)
            or proxy.get("status") != "ok"
            or proxy.get("service") != "signaling"
        ):
            raise ValueError("Hosted website must expose its same-origin /signal proxy")
    with opener.open(website + "/", timeout=3) as response:
        if b"FlowDrop" not in response.read(262144):
            raise ValueError("Public website does not serve the FlowDrop frontend")
    return info


class OnlineService:
    def __init__(self, path=None):
        self.path = path or settings_path()
        self.dev = os.getenv("FLOWDROP_ONLINE_DEV") == "1"
        self.lock = threading.Lock()
        self.cached = None
        self.checked = 0
        try:
            saved = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            saved = {}
        if not isinstance(saved, dict):
            saved = {}
        self.website = os.getenv("FLOWDROP_ONLINE_URL", saved.get("website", ""))
        self.signaling = os.getenv("FLOWDROP_SIGNAL_URL", saved.get("signaling", ""))
        if not isinstance(self.website, str) or not isinstance(self.signaling, str):
            self.website, self.signaling = "", ""

    def save(self, website, signaling):
        website = endpoint(website, self.dev) if website.strip() else ""
        signaling = (
            endpoint(signaling or website + "/signal", self.dev) if website else ""
        )
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.path.with_suffix(".tmp")
            temporary.write_text(
                json.dumps({"website": website, "signaling": signaling}),
                encoding="utf-8",
            )
            temporary.replace(self.path)
            self.website, self.signaling = website, signaling
            self.cached = None
        return {"status": "saved"}

    def status(self):
        if not self.lock.acquire(blocking=False):
            return self.cached or {
                "mode": "desktop",
                "available": False,
                "configured": bool(self.website),
                "message": "Checking configured online service; retry shortly.",
                "website": "",
                "signaling": "",
            }
        try:
            if self.cached is not None and time.monotonic() - self.checked < 15:
                return self.cached
            result = {
                "mode": "desktop",
                "available": False,
                "configured": bool(self.website),
                "message": UNCONFIGURED,
                "website": "",
                "signaling": "",
                "development": self.dev,
            }
            if self.website:
                try:
                    website = endpoint(self.website, self.dev)
                    signaling = endpoint(
                        self.signaling or website + "/signal", self.dev
                    )
                    result.update(website=website, signaling=signaling)
                    info = check_service(website, signaling)
                    result.update(
                        available=True,
                        website=website,
                        signaling=signaling,
                        message="Hosted online service is reachable. Open the public website to create or join a room.",
                        service=info,
                    )
                except (OSError, ValueError, TypeError) as exc:
                    result["message"] = (
                        "Online Sharing is unavailable: configured HTTPS website/signaling check failed ("
                        + type(exc).__name__
                        + "). Check endpoints, TLS certificate and service health."
                    )
            self.cached, self.checked = result, time.monotonic()
            return result
        finally:
            self.lock.release()
