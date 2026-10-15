"""Disposable TCP TURN fixture for same-PC browser relay tests; never deploy."""

import json
import secrets
from pathlib import Path


def main():
    root = Path(".flowdrop/tools")
    root.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_hex(32)
    (root / "turn-browser-secret.json").write_text(
        json.dumps({"secret": secret}), encoding="utf-8"
    )
    (root / "turn-browser.conf").write_text(
        f"""listening-ip=127.0.0.1
relay-ip=127.0.0.1
listening-port=53579
min-port=54200
max-port=54210
realm=flowdrop-browser-test
use-auth-secret
static-auth-secret={secret}
cli=false
no-tls
dtls=false
fingerprint
allow-loopback-peers=true
verbose
no-multicast-peers
user-quota=4
total-quota=12
max-bps=10485760
log-file=stdout
pidfile=/tmp/flowdrop-browser-turn.pid
""",
        encoding="utf-8",
        newline="\n",
    )
    print(
        "Prepared loopback-only browser TURN fixture. Loopback peer permission is TEST ONLY; production denies it."
    )


if __name__ == "__main__":
    main()
