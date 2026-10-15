"""Disposable loopback test host. Never deploy this fixture."""

import os
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path
from tempfile import TemporaryDirectory

port = int(os.getenv("FLOWDROP_E2E_PORT", "8765"))
if port not in (8765, 8768, 8769):
    raise ValueError("Only fixed disposable loopback test ports are permitted")
os.environ["FLOWDROP_ORIGINS"] = f"http://127.0.0.1:{port}"
import uvicorn
from fastapi import FastAPI

from services.cloud_api.app import LocalStore, S3Store
from services.cloud_api.app import create_app as create_cloud
from services.lan_server.app import create_app
from services.signaling.app import create_app as create_signal

temporary = TemporaryDirectory()
lan = create_app(Path(temporary.name), "e2e-host-only")
signaling = create_signal()
if os.getenv("FLOWDROP_E2E_INFRA") == "1":
    from sqlalchemy.engine import make_url

    database = os.environ["DATABASE_URL"]
    url = make_url(database)
    if url.host not in ("127.0.0.1", "localhost") or not url.database.endswith(
        "_integration"
    ):
        raise ValueError(
            "Browser integration fixture requires a disposable loopback database"
        )
    cloud = create_cloud(database, S3Store())
else:
    cloud = create_cloud(
        "sqlite:///" + str(Path(temporary.name) / "cloud.db"),
        LocalStore(Path(temporary.name) / "ciphertext"),
    )


@asynccontextmanager
async def lifespan(app):
    async with AsyncExitStack() as stack:
        for child in (lan, signaling, cloud):
            await stack.enter_async_context(child.router.lifespan_context(child))
        yield


app = FastAPI(lifespan=lifespan)
app.mount("/signal", signaling)
app.mount("/cloud", cloud)
app.mount("/", lan)
if __name__ == "__main__":
    try:
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    finally:
        temporary.cleanup()
