"""Dedicated online signaling target; no desktop, cloud or database dependency."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI

from services.signaling.app import create_app as signaling_app


class CloseFrameAudit:
    """Record close lifecycle only; never log tokens, frames, or room identifiers."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "websocket":
            return await self.app(scope, receive, send)
        logger = logging.getLogger("uvicorn.error")

        async def audited_send(message):
            if message["type"] != "websocket.close":
                return await send(message)
            code = message.get("code", 1000)
            logger.info("Signaling close requested code=%s", code)
            try:
                await send(message)
            except (Exception, asyncio.CancelledError) as error:
                logger.warning(
                    "Signaling close failed code=%s exception=%s",
                    code,
                    type(error).__name__,
                )
                raise
            logger.info("Signaling close completed code=%s", code)

        await self.app(scope, receive, audited_send)


def create_app():
    origins = os.getenv("FLOWDROP_ORIGINS", "")
    if not origins:
        raise ValueError("Set FLOWDROP_ORIGINS to the exact authorized HTTPS website")
    for value in origins.split(","):
        url = urlsplit(value)
        if (
            url.scheme != "https"
            or not url.hostname
            or url.path
            or url.query
            or url.fragment
            or url.username
            or url.password
            or "*" in value
        ):
            raise ValueError("Public signaling origins must be exact HTTPS origins")
    child = signaling_app()

    @asynccontextmanager
    async def lifespan(app):
        async with child.router.lifespan_context(child):
            yield

    app = FastAPI(title="FlowDrop public signaling", lifespan=lifespan)
    app.add_middleware(CloseFrameAudit)

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "service": "signaling",
            "state": "redis" if os.getenv("REDIS_URL") else "temporary-single-process",
        }

    app.mount("/signal", child)
    return app
