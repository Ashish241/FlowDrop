"""Disposable loopback test host. Never deploy this fixture."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ["FLOWDROP_ORIGINS"] = "http://127.0.0.1:8765"
import uvicorn
from fastapi import FastAPI

from services.cloud_api.app import LocalStore
from services.cloud_api.app import create_app as create_cloud
from services.lan_server.app import create_app
from services.signaling.app import create_app as create_signal

temporary = TemporaryDirectory()
lan = create_app(Path(temporary.name), "e2e-host-only")
app = FastAPI()
app.mount("/signal", create_signal())
app.mount(
    "/cloud",
    create_cloud(
        "sqlite:///" + str(Path(temporary.name) / "cloud.db"),
        LocalStore(Path(temporary.name) / "ciphertext"),
    ),
)
app.mount("/", lan)
if __name__ == "__main__":
    try:
        uvicorn.run(app, host="127.0.0.1", port=8765, log_level="warning")
    finally:
        temporary.cleanup()
