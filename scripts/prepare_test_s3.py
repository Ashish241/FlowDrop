"""Prepare private, disposable Garage config; does not install a system service."""

import json
import secrets
from pathlib import Path

root = Path(".flowdrop/tools").resolve()
linux = (
    "/mnt/" + root.drive[0].lower() + root.as_posix()[2:]
    if root.drive
    else root.as_posix()
)
credentials = {
    "AWS_ACCESS_KEY_ID": "GK" + secrets.token_hex(16),
    "AWS_SECRET_ACCESS_KEY": secrets.token_hex(32),
    "AWS_DEFAULT_REGION": "garage",
    "S3_ENDPOINT": "http://127.0.0.1:53900",
    "S3_BUCKET": "flowdrop-integration",
}
(root / "garage-credentials.json").write_text(json.dumps(credentials))
(root / "garage.toml").write_text(f'''metadata_dir = "{linux}/garage-metadata"
data_dir = "{linux}/garage-data"
db_engine = "sqlite"
replication_factor = 1
rpc_bind_addr = "127.0.0.1:53901"
rpc_public_addr = "127.0.0.1:53901"
rpc_secret = "{secrets.token_hex(32)}"
[s3_api]
s3_region = "garage"
api_bind_addr = "127.0.0.1:53900"
''')
(root / "garage-start.sh").write_text(
    f"""#!/bin/bash
set -eu
export GARAGE_CONFIG_FILE='{linux}/garage.toml'
export GARAGE_DEFAULT_ACCESS_KEY='{credentials["AWS_ACCESS_KEY_ID"]}'
export GARAGE_DEFAULT_SECRET_KEY='{credentials["AWS_SECRET_ACCESS_KEY"]}'
export GARAGE_DEFAULT_BUCKET='{credentials["S3_BUCKET"]}'
exec '{linux}/garage' server --single-node --default-bucket
""",
    newline="\n",
)
print("Prepared disposable loopback Garage configuration.")
