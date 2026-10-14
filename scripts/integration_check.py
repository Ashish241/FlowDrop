"""Run against explicitly supplied disposable services; no public provisioning."""

import json
import os
import secrets
import subprocess
from pathlib import Path

from sqlalchemy.engine import URL, make_url


def main():
    env = dict(os.environ)
    runtime = Path(".flowdrop/integration-runtime.json")
    if runtime.exists():
        env.update(json.loads(runtime.read_text()))
    if not env.get("DATABASE_URL"):
        password = Path(".flowdrop/pg-test-password").read_text()
        env["DATABASE_URL"] = URL.create(
            "postgresql+psycopg",
            username="flowdrop_test",
            password=password,
            host="127.0.0.1",
            port=55432,
            database="flowdrop_integration",
        ).render_as_string(hide_password=False)
    url = make_url(env["DATABASE_URL"])
    if url.host not in ("127.0.0.1", "localhost") or not url.database.endswith(
        "_integration"
    ):
        raise ValueError(
            "Integration runner requires an explicitly disposable loopback database ending in _integration"
        )
    env["REDIS_URL"] = env.get("REDIS_URL", "redis://127.0.0.1:56379/0")
    env["FLOWDROP_INTEGRATION"] = "1"
    env["FLOWDROP_REDIS_NAMESPACE"] = "integration:" + secrets.token_hex(8) + ":"
    credentials = Path(".flowdrop/tools/garage-credentials.json")
    if credentials.exists():
        env.update(json.loads(credentials.read_text()))
    subprocess.run(["python", "-m", "alembic", "upgrade", "head"], env=env, check=True)
    subprocess.run(
        ["python", "-m", "pytest", "tests/integration", "-q"], env=env, check=True
    )


if __name__ == "__main__":
    main()
