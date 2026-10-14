"""Generate test-only credentials for an isolated Compose project."""

import json
import secrets
from pathlib import Path

root = Path(".flowdrop")
root.mkdir(exist_ok=True)
password, redis_password = secrets.token_hex(32), secrets.token_hex(32)
(root / "pg-test-password").write_text(password)
garage = json.loads((root / "tools/garage-credentials.json").read_text())
(root / "integration-runtime.json").write_text(
    json.dumps({"REDIS_URL": "redis://:" + redis_password + "@127.0.0.1:56379/0"})
)
(root / "integration.env").write_text(
    "\n".join(
        [
            "POSTGRES_PASSWORD=" + password,
            "REDIS_PASSWORD=" + redis_password,
            "GARAGE_RPC_SECRET=" + secrets.token_hex(32),
            "S3_ACCESS_KEY=" + garage["AWS_ACCESS_KEY_ID"],
            "S3_SECRET_KEY=" + garage["AWS_SECRET_ACCESS_KEY"],
        ]
    )
    + "\n"
)
print("Prepared disposable Compose credentials; no credentials printed.")
