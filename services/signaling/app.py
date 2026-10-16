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

from services.signaling.ice import ice_configuration
from services.version import VERSION


def create_app():
    ice_configuration()  # Reject incomplete/unsafe ICE configuration before serving.
    if os.getenv("REDIS_URL"):
        from services.signaling.distributed import create_distributed_app

        return create_distributed_app(
            prefix=os.getenv("FLOWDROP_REDIS_NAMESPACE", "") + "flowdrop:signal:"
        )
    rooms = {}
    codes = {}
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
                        await ws.close(code=1008)
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

    app = FastAPI(title="FlowDrop signaling", version=VERSION, lifespan=lifespan)

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed),
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )

    def rate(request, bucket="pairing"):
        # Keep ICE refresh/revocation from exhausting the code-guessing budget.
        ip = (request.client.host, bucket)
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
        config = ice_configuration()
        return {
            "status": "ok",
            "service": "signaling",
            "protocol": 1,
            "turnConfigured": config["turnConfigured"],
            "stunConfigured": config["stunConfigured"],
        }

    @app.post("/rooms")
    async def create(request: Request):
        rate(request)
        if len(rooms) >= 1000:
            raise HTTPException(503, "Room capacity reached")
        for key, (_, expires) in list(codes.items()):
            if expires <= time.time():
                codes.pop(key, None)
        for _ in range(16):
            code = f"{secrets.randbelow(1000000):06d}"
            if code not in codes:
                break
        else:
            raise HTTPException(503, "Pairing code capacity reached")
        rid = secrets.token_hex(16)
        codes[code] = (rid, time.time() + 600)
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
            "code": code,
        }
        return {
            "room": rid,
            "token": token,
            "member": "owner",
            "pairing_code": code,
            "code_expires": codes[code][1],
            "expires": rooms[rid]["expires"],
        }

    @app.post("/rooms/{rid}/join")
    async def join(rid: str, request: Request):
        rate(request)
        if len(rid) == 6 and rid.isascii() and rid.isdigit():
            entry = codes.get(rid)
            if not entry or entry[1] <= time.time():
                raise HTTPException(404, "Pairing code expired or unavailable")
            rid = entry[0]
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
        rate(request, "ice")
        supplied = hashlib.sha256(
            request.headers.get("authorization", "").removeprefix("Bearer ").encode()
        ).hexdigest()
        member = next(
            (
                member
                for room in rooms.values()
                if room["expires"] > time.time()
                for member in room["members"].values()
                if hmac.compare_digest(member["token"], supplied)
            ),
            None,
        )
        if member is None:
            raise HTTPException(401, "Room authorization required")
        config = ice_configuration()
        if not member["approved"]:
            config["iceServers"] = [
                server for server in config["iceServers"] if "credential" not in server
            ]
            config["pendingApproval"] = True
        return config

    @app.delete("/rooms/{rid}")
    async def revoke(rid: str, request: Request):
        rate(request, "revoke")
        room = room_for(rid)
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        if not hmac.compare_digest(
            room["members"]["owner"]["token"],
            hashlib.sha256(token.encode()).hexdigest(),
        ):
            raise HTTPException(403, "Owner required")
        rooms.pop(rid, None)
        if codes.get(room["code"], (None,))[0] == rid:
            codes.pop(room["code"], None)
        for socket in list(room["sockets"].values()):
            await socket.close(code=1008)
        return {"status": "revoked"}

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
            # Both sides must renegotiate when an approved participant reconnects.
            if len(room["sockets"]) == 2 and all(
                m["approved"] for m in room["members"].values()
            ):
                owner = room["sockets"].get("owner")
                if owner:
                    await owner.send_json({"type": "ready"})
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
                and "receiver" in room["sockets"]
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

    from services.signaling.rooms import install_rooms

    install_rooms(app, allowed)
    return app


app = create_app()
