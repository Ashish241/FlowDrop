"""Start a loopback development host without opening a browser."""

import os
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI

from services.lan_server.app import create_app
from services.signaling.app import app as signaling

lan = create_app(Path(".flowdrop/lan"))
children = [lan, signaling]
cloud = None
if os.getenv("FLOWDROP_DEV_CLOUD") == "1":
    from services.cloud_api.app import LocalStore
    from services.cloud_api.app import create_app as create_cloud

    root = Path(".flowdrop/cloud")
    root.mkdir(parents=True, exist_ok=True)
    cloud = create_cloud(
        "sqlite:///" + str(root.resolve() / "metadata.db"), LocalStore(root / "objects")
    )
    children.append(cloud)


@asynccontextmanager
async def lifespan(app):
    async with AsyncExitStack() as stack:
        for child in children:
            await stack.enter_async_context(child.router.lifespan_context(child))
        yield


app = FastAPI(lifespan=lifespan)
app.mount("/signal", signaling)
if cloud:
    app.mount("/cloud", cloud)
app.mount("/", lan)
if __name__ == "__main__":
    print("Host dashboard: http://127.0.0.1:8000/#host=" + lan.state.host_token)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
