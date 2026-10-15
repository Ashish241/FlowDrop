"""Verify assigned deployments after approval; creates/revokes one temporary room.

Checks HTTP/WSS and metadata routing, NOT physical Internet file transfers.
No capability, room code, SDP or TURN credential is printed or saved.
"""

import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from websockets.sync.client import connect


def endpoint(value, local=False):
    url = urlsplit(value.rstrip("/"))
    loopback = url.hostname in ("127.0.0.1", "localhost")
    if (
        not url.hostname
        or url.username
        or url.password
        or url.query
        or url.fragment
        or (url.scheme != "https" and not (local and loopback and url.scheme == "http"))
        or (loopback and not local)
    ):
        raise ValueError("Use actual HTTPS URLs; loopback requires --allow-loopback")
    return value.rstrip("/")


def verify(website, signaling, local=False):
    website, signaling = endpoint(website, local), endpoint(signaling, local)
    origin = "{0.scheme}://{0.netloc}".format(urlsplit(website))
    owner = None
    result = {
        "website": website,
        "signaling": signaling,
        "scope": "local harness" if local else "public HTTP/WSS service checks",
        "physical_cross_network_transfer_verified": False,
    }
    with httpx.Client(trust_env=False, follow_redirects=False, timeout=90) as client:
        try:
            home = client.get(website + "/")
            assert home.status_code == 200 and "FlowDrop" in home.text
            config = client.get(website + "/DEPLOYMENT_INFO.json").json()
            if not local:
                assert config["pagesRelease"] and config["signaling"] == signaling
                csp = home.headers.get("content-security-policy", "")
                signal_origin = "{0.scheme}://{0.netloc}".format(urlsplit(signaling))
                assert (
                    signal_origin in csp
                    and signal_origin.replace("https:", "wss:") in csp
                )
            for source in re.findall(r'<script[^>]+src="([^"]+)"', home.text):
                assert source.startswith("/assets/")
                bundle = client.get(website + source)
                assert bundle.status_code == 200
                assert not re.search(
                    r"https?://(?:localhost|127\.0\.0\.1|192\.168\.|10\.)", bundle.text
                )
            health = client.get(signaling + "/health", headers={"Origin": origin})
            assert health.status_code == 200 and health.json()["service"] == "signaling"
            assert health.headers.get("access-control-allow-origin") == origin
            preflight = client.options(
                signaling + "/rooms",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "authorization",
                },
            )
            assert (
                preflight.status_code == 200
                and preflight.headers.get("access-control-allow-origin") == origin
            )
            owner = client.post(signaling + "/rooms", headers={"Origin": origin}).json()
            socket_url = (
                signaling.replace("https:", "wss:").replace("http:", "ws:")
                + "/rooms/"
                + owner["room"]
                + "/ws"
            )
            with connect(socket_url, origin=origin, proxy=None, open_timeout=20) as a:
                a.send(owner["token"])
                assert json.loads(a.recv(timeout=10))["type"] == "authorized"
                receiver = client.post(
                    signaling + "/rooms/" + owner["pairing_code"] + "/join",
                    headers={"Origin": origin},
                ).json()
                assert receiver["room"] == owner["room"]
                with connect(
                    socket_url, origin=origin, proxy=None, open_timeout=20
                ) as b:
                    b.send(receiver["token"])
                    assert json.loads(b.recv(timeout=10))["approved"] is False
                    assert json.loads(a.recv(timeout=10))["type"] == "join-request"
                    a.send(json.dumps({"type": "approve"}))
                    assert json.loads(b.recv(timeout=10))["type"] == "approved"
                    assert json.loads(a.recv(timeout=10))["type"] == "ready"
                    a.send(
                        json.dumps(
                            {"type": "offer", "sdp": "metadata-routing-check-only"}
                        )
                    )
                    assert (
                        json.loads(b.recv(timeout=10))["sdp"]
                        == "metadata-routing-check-only"
                    )
            result.update(
                frontend=True,
                configuration_checked=True,
                pages_release_validated=not local,
                health=True,
                exact_origin_cors=True,
                websocket_authorization=True,
                six_digit_join=True,
                owner_approval=True,
                metadata_routing=True,
                turn_configured=health.json().get("turnConfigured", False),
            )
        finally:
            if owner and "token" in owner and "room" in owner:
                response = client.delete(
                    signaling + "/rooms/" + owner["room"],
                    headers={
                        "Origin": origin,
                        "Authorization": "Bearer " + owner["token"],
                    },
                )
                assert response.status_code == 200
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--website", required=True)
    parser.add_argument("--signaling", required=True)
    parser.add_argument("--allow-loopback", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = verify(args.website, args.signaling, args.allow_loopback)
    content = json.dumps(result, indent=2) + "\n"
    if args.output:
        args.output.write_text(content, encoding="utf-8")
    print(content)


if __name__ == "__main__":
    main()
