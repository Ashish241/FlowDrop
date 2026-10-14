"""Configure the locally compiled coturn for private allocation/auth tests."""

import json
import os
import secrets
from pathlib import Path

root = Path(".flowdrop/tools")
bind = os.getenv("FLOWDROP_TEST_TURN_BIND", "127.0.0.1")
if bind not in ("127.0.0.1", "0.0.0.0"):
    raise ValueError("Test bind must be loopback or a disposable container listener")
relay = "relay-ip=127.0.0.1\n" if bind == "127.0.0.1" else ""
secret = secrets.token_hex(32)
(root / "turn-secret.json").write_text(json.dumps({"secret": secret}))
(root / "turn.conf").write_text(
    f"""listening-ip={bind}
{relay}
listening-port=53578
min-port=54160
max-port=54170
realm=flowdrop-test
use-auth-secret
static-auth-secret={secret}
cli=false
no-tls
dtls=false
fingerprint
no-multicast-peers
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
user-quota=2
total-quota=8
max-bps=10485760
log-file=stdout
pidfile=/tmp/flowdrop-coturn-test.pid
""",
    newline="\n",
)
print("Prepared loopback-only coturn allocation test configuration.")
