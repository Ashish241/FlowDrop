"""Shared ICE configuration; only short-lived derived TURN credentials leave server."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from urllib.parse import parse_qs, urlsplit


def urls(name, legacy, schemes):
    raw = os.getenv(name)
    values = (
        json.loads(raw) if raw else [os.environ[legacy]] if os.getenv(legacy) else []
    )
    if not isinstance(values, list) or len(values) > 8:
        raise ValueError(name + " must be a JSON array of at most eight ICE URLs")
    for value in values:
        if (
            not isinstance(value, str)
            or len(value) > 512
            or urlsplit(value).scheme not in schemes
            or any(c.isspace() for c in value)
            or "@" in value
        ):
            raise ValueError("Invalid ICE URL in " + name)
        target = urlsplit("https://" + value.split(":", 1)[1])
        transport = parse_qs(target.query, keep_blank_values=True)
        if (
            not target.hostname
            or target.path
            or target.fragment
            or (target.port is not None and not 1 <= target.port <= 65535)
            or set(transport) - {"transport"}
            or (transport and transport.get("transport") not in (["udp"], ["tcp"]))
        ):
            raise ValueError("Invalid ICE host/port/transport in " + name)
    return values


def ice_configuration():
    stun = urls("FLOWDROP_STUN_URLS", "FLOWDROP_STUN_URL", {"stun", "stuns"})
    turn = urls("FLOWDROP_TURN_URLS", "FLOWDROP_TURN_URL", {"turn", "turns"})
    secret = os.getenv("FLOWDROP_TURN_SECRET", "")
    if bool(turn) != bool(secret):
        raise ValueError(
            "TURN URLs and FLOWDROP_TURN_SECRET must be configured together"
        )
    if secret and len(secret) < 32:
        raise ValueError("TURN secret must contain at least 32 characters")
    policy = os.getenv("FLOWDROP_ICE_POLICY", "all")
    if policy not in ("all", "relay") or (policy == "relay" and not turn):
        raise ValueError("Relay-only mode requires authenticated TURN configuration")
    servers = [{"urls": stun}] if stun else []
    expires = int(time.time()) + 600
    if turn:
        username = f"{expires}:{secrets.token_hex(8)}"
        credential = base64.b64encode(
            hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()
        ).decode()
        servers.append({"urls": turn, "username": username, "credential": credential})
    return {
        "iceServers": servers,
        "iceTransportPolicy": policy,
        "turnConfigured": bool(turn),
        "stunConfigured": bool(stun),
        "credentialExpires": expires if turn else None,
    }
