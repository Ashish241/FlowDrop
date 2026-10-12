"""Single-process signaling: messages only, never file payloads."""

import asyncio
import hashlib
import hmac
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


def create_app():
    rooms = {}
    limits = {}
    allowed = set(
        os.getenv(
            "FLOWDROP_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000"
        ).split(",")
    )

    async def sweep():
        while True:
            await asyncio.sleep(30)
            for rid, room in list(rooms.items()):
                if room["expires"] < time.time():
                    for ws in list(room["sockets"].values()):
                        await ws.close(code=1000)
                    rooms.pop(rid, None)

    @asynccontextmanager
    async def lifespan(app):
        logging.getLogger("uvicorn.access").disabled = True
        task = asyncio.create_task(sweep())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    app = FastAPI(title="FlowDrop signaling", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )

    def rate(request):
        ip = request.client.host
        now = time.time()
        entries = [t for t in limits.get(ip, []) if t > now - 60]
        if len(entries) >= 20:
            raise HTTPException(429, "Rate limit exceeded")
        if len(limits) > 10000:
            limits.clear()
        limits[ip] = entries + [now]
        origin = request.headers.get("origin")
        if origin and origin not in allowed:
            raise HTTPException(403, "Origin denied")

    def room_for(rid):
        room = rooms.get(rid)
        if not room or room["expires"] < time.time():
            raise HTTPException(404, "Room expired or unavailable")
        return room

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "signaling"}

    @app.post("/rooms")
    def create(request: Request):
        rate(request)
        if len(rooms) >= 1000:
            raise HTTPException(503, "Room capacity reached")
        rid = secrets.token_hex(16)
        token = secrets.token_urlsafe(32)
        rooms[rid] = {
            "expires": time.time() + 3600,
            "members": {
                "owner": {
                    "token": hashlib.sha256(token.encode()).hexdigest(),
                    "approved": True,
                }
            },
            "sockets": {},
        }
        return {
            "room": rid,
            "token": token,
            "member": "owner",
            "expires": rooms[rid]["expires"],
        }

    @app.post("/rooms/{rid}/join")
    async def join(rid: str, request: Request):
        rate(request)
        room = room_for(rid)
        if len(room["members"]) >= 2:
            raise HTTPException(409, "Room already has a receiver")
        token = secrets.token_urlsafe(32)
        room["members"]["receiver"] = {
            "token": hashlib.sha256(token.encode()).hexdigest(),
            "approved": False,
        }
        return {
            "room": rid,
            "token": token,
            "member": "receiver",
            "expires": room["expires"],
        }

    @app.get("/ice")
    def ice(request: Request):
        rate(request)
        supplied = hashlib.sha256(
            request.headers.get("authorization", "").removeprefix("Bearer ").encode()
        ).hexdigest()
        if not any(
            room["expires"] > time.time()
            and any(
                hmac.compare_digest(member["token"], supplied)
                for member in room["members"].values()
            )
            for room in rooms.values()
        ):
            raise HTTPException(401, "Room authorization required")
        config = []
        stun = os.getenv("FLOWDROP_STUN_URL")
        if stun:
            config.append({"urls": stun})
        secret = os.getenv("FLOWDROP_TURN_SECRET")
        url = os.getenv("FLOWDROP_TURN_URL")
        if secret and url:
            import base64

            username = f"{int(time.time() + 600)}:{secrets.token_hex(8)}"
            credential = base64.b64encode(
                hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()
            ).decode()
            config.append({"urls": url, "username": username, "credential": credential})
        return {"iceServers": config}

    @app.websocket("/rooms/{rid}/ws")
    async def signaling(ws: WebSocket, rid: str):
        origin = ws.headers.get("origin")
        if origin and origin not in allowed:
            await ws.close(code=1008)
            return
        room = rooms.get(rid)
        if not room or room["expires"] < time.time():
            await ws.close(code=1008)
            return
        await ws.accept()
        member = None
        try:
            token = await asyncio.wait_for(ws.receive_text(), 5)
            digest = hashlib.sha256(token.encode()).hexdigest()
            member = next(
                (
                    key
                    for key, value in room["members"].items()
                    if hmac.compare_digest(value["token"], digest)
                ),
                None,
            )
            if not member:
                await ws.close(code=1008)
                return
            previous = room["sockets"].get(member)
            if previous:
                await previous.close(code=1000)
            room["sockets"][member] = ws
            await ws.send_json(
                {
                    "type": "authorized",
                    "member": member,
                    "approved": room["members"][member]["approved"],
                }
            )
            if member == "receiver" and not room["members"]["receiver"]["approved"]:
                owner = room["sockets"].get("owner")
                if owner:
                    await owner.send_json(
                        {"type": "join-request", "member": "receiver"}
                    )
            if (
                member == "owner"
                and "receiver" in room["members"]
                and not room["members"]["receiver"]["approved"]
            ):
                await ws.send_json({"type": "join-request", "member": "receiver"})
            timestamps = []
            while True:
                raw = await ws.receive_text()
                if len(raw) > 65536:
                    await ws.close(code=1009)
                    break
                now = time.time()
                timestamps = [t for t in timestamps if t > now - 10]
                if len(timestamps) > 100 or room["expires"] < now:
                    await ws.close(code=1008)
                    break
                timestamps.append(now)
                import json

                data = json.loads(raw)
                if not isinstance(data, dict):
                    await ws.close(code=1008)
                    break
                other = "receiver" if member == "owner" else "owner"
                target = room["sockets"].get(other)
                if (
                    data.get("type") == "approve"
                    and member == "owner"
                    and "receiver" in room["members"]
                ):
                    room["members"]["receiver"]["approved"] = True
                    if target:
                        await target.send_json({"type": "approved"})
                    await ws.send_json({"type": "ready"})
                elif (
                    data.get("type") in ("offer", "answer", "ice")
                    and all(m["approved"] for m in room["members"].values())
                    and len(room["members"]) == 2
                ):
                    if target:
                        field = "candidate" if data["type"] == "ice" else "sdp"
                        payload = data.get(field)
                        if (field == "sdp" and isinstance(payload, str)) or (
                            field == "candidate" and isinstance(payload, dict)
                        ):
                            await target.send_json(
                                {"type": data["type"], field: payload}
                            )
        except (TimeoutError, WebSocketDisconnect, ValueError, RuntimeError):
            pass
        finally:
            if member and room["sockets"].get(member) is ws:
                room["sockets"].pop(member, None)

    return app


app = create_app()
