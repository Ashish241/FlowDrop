"""Disposable independent product test host; loopback only, never deploy."""

import argparse
import os
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from services.lan_server.app import create_app as lan_app
from services.signaling.app import create_app as signal_app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("product", choices=["desktop", "online"])
    args = parser.parse_args()
    port = 8770 if args.product == "online" else 8771
    os.environ["FLOWDROP_ORIGINS"] = f"http://127.0.0.1:{port}"
    with TemporaryDirectory(prefix="flowdrop-product-") as directory:
        if args.product == "desktop":
            app = lan_app(
                Path(directory), "e2e-host-only", frontend=Path("apps/web/dist-desktop")
            )
        else:
            child = signal_app()

            @asynccontextmanager
            async def lifespan(app):
                async with child.router.lifespan_context(child):
                    yield

            app = FastAPI(lifespan=lifespan)
            app.mount("/signal", child)
            app.mount("/", StaticFiles(directory="apps/web/dist-online", html=True))
        uvicorn.run(
            app, host="127.0.0.1", port=port, log_level="warning", access_log=False
        )


if __name__ == "__main__":
    main()
