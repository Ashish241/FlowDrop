"""Redis room authority and cross-worker routing. Redis failure is fail-closed."""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from redis.asyncio import Redis
from redis.exceptions import RedisError, WatchError

from services.request_security import client_ip
from services.version import VERSION


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class RoomStore:
    def __init__(self, redis, prefix="flowdrop:signal:"):
        self.redis, self.prefix = redis, prefix

    def key(self, rid):
        if (
            not isinstance(rid, str)
            or len(rid) != 32
            or any(c not in "0123456789abcdef" for c in rid)
        ):
            raise HTTPException(404, "Room unavailable")
        return self.prefix + "room:" + rid

    async def get(self, rid):
        raw = await self.redis.get(self.key(rid))
        if not raw:
            raise HTTPException(404, "Room expired or revoked")
        room = json.loads(raw)
        return room

    async def mutate(self, rid, change):
        key = self.key(rid)
        for _ in range(12):
            async with self.redis.pipeline() as pipe:
                try:
                    await pipe.watch(key)
                    raw = await pipe.get(key)
                    if not raw:
                        raise HTTPException(404, "Room expired or revoked")
                    room = json.loads(raw)
                    ttl = await pipe.ttl(key)
                    if ttl <= 0:
                        raise HTTPException(404, "Room expired or revoked")
                    result = change(room)
                    pipe.multi()
                    pipe.set(key, json.dumps(room), keepttl=True)
                    await pipe.execute()
                    return room, result
                except WatchError:
                    continue
        raise HTTPException(503, "Room busy; retry")

    async def authorize(self, rid, token):
        room = await self.get(rid)
        hashed = digest(token)
        member = next(
            (
                name
                for name, data in room["members"].items()
                if hmac.compare_digest(data["token"], hashed)
            ),
            None,
        )
        if not member:
            raise HTTPException(401, "Room authorization required")
        return room, member

    async def send(self, rid, member, message):
        await self.redis.publish(
            self.prefix + "events:" + rid + ":" + member, json.dumps(message)
        )

    async def allow(self, identity, count=20, seconds=60):
        key = self.prefix + "rate:" + digest(identity)
        script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n"
        return await self.redis.eval(script, 1, key, seconds) <= count


def create_distributed_app(redis=None, prefix="flowdrop:signal:"):
    owned = redis is None
    redis = redis or Redis.from_url(
        os.environ["REDIS_URL"],
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=5,
    )
    store = RoomStore(redis, prefix)
    origins = set(
        os.getenv(
            "FLOWDROP_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000"
        ).split(",")
    )

    @asynccontextmanager
    async def lifespan(app):
        logging.getLogger("uvicorn.access").disabled = True
        await redis.ping()
        yield
        if owned:
            await redis.aclose()

    app = FastAPI(
        title="FlowDrop distributed signaling",
        version=VERSION,
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
    )
    app.state.store = store
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(origins),
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def failures(request, call_next):
        from starlette.responses import JSONResponse

        try:
            if (
                request.headers.get("origin")
                and request.headers["origin"] not in origins
            ):
                raise HTTPException(403, "Origin denied")
            if not await store.allow("http:" + client_ip(request)):
                return JSONResponse(
                    {"detail": "Rate limit exceeded"},
                    429,
                    headers={"Retry-After": "60"},
                )
            response = await call_next(request)
            response.headers["Cache-Control"] = "no-store"
            response.headers["Referrer-Policy"] = "no-referrer"
            return response
        except HTTPException as exc:
            return JSONResponse({"detail": exc.detail}, exc.status_code)
        except RedisError:
            return JSONResponse(
                {"detail": "Signaling state unavailable; retry later"}, 503
            )

    @app.get("/health")
    async def health():
        await redis.ping()
        return {"status": "ok", "service": "signaling", "state": "redis"}

    @app.post("/rooms")
    async def create():
        rid, token = secrets.token_hex(16), secrets.token_urlsafe(32)
        server_time = await redis.time()
        expiry = server_time[0] + server_time[1] / 1000000 + 3600
        room = {
            "expires": expiry,
            "members": {
                "owner": {"token": digest(token), "approved": True, "connection": None}
            },
        }
        script = "redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[1]); if redis.call('ZCARD',KEYS[2])>=1000 then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',3600); redis.call('ZADD',KEYS[2],ARGV[3],KEYS[1]); return 1"
        if not await redis.eval(
            script,
            2,
            store.key(rid),
            prefix + "rooms",
            expiry - 3600,
            json.dumps(room),
            expiry,
        ):
            raise HTTPException(503, "Room capacity reached")
        await redis.set(prefix + "token:" + digest(token), rid, ex=3600)
        return {"room": rid, "token": token, "member": "owner", "expires": expiry}

    @app.post("/rooms/{rid}/join")
    async def join(rid: str):
        token = secrets.token_urlsafe(32)

        def change(room):
            if "receiver" in room["members"]:
                raise HTTPException(409, "Room already has a receiver")
            room["members"]["receiver"] = {
                "token": digest(token),
                "approved": False,
                "connection": None,
            }

        room, _ = await store.mutate(rid, change)
        await redis.set(
            prefix + "token:" + digest(token),
            rid,
            ex=max(1, await redis.ttl(store.key(rid))),
        )
        return {
            "room": rid,
            "token": token,
            "member": "receiver",
            "expires": room["expires"],
        }

    def bearer(request):
        return request.headers.get("authorization", "").removeprefix("Bearer ")

    @app.delete("/rooms/{rid}")
    async def revoke(rid: str, request: Request):
        room, member = await store.authorize(rid, bearer(request))
        if member != "owner":
            raise HTTPException(403, "Owner required")
        await redis.delete(store.key(rid))
        await redis.zrem(prefix + "rooms", store.key(rid))
        await redis.delete(
            *(prefix + "token:" + value["token"] for value in room["members"].values())
        )
        for name in ("owner", "receiver"):
            await store.send(rid, name, {"type": "revoked"})
        return {"status": "revoked"}

    @app.get("/ice")
    async def ice(request: Request):
        token = bearer(request)
        rid = await redis.get(prefix + "token:" + digest(token))
        if not rid:
            raise HTTPException(401, "Room authorization required")
        await store.authorize(rid, token)
        servers = []
        if os.getenv("FLOWDROP_STUN_URL"):
            servers.append({"urls": os.environ["FLOWDROP_STUN_URL"]})
        secret, url = os.getenv("FLOWDROP_TURN_SECRET"), os.getenv("FLOWDROP_TURN_URL")
        if secret and url:
            username = f"{int(time.time() + 600)}:{secrets.token_hex(8)}"
            credential = base64.b64encode(
                hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()
            ).decode()
            servers.append(
                {"urls": url, "username": username, "credential": credential}
            )
        return {"iceServers": servers}

    @app.websocket("/rooms/{rid}/ws")
    async def websocket(ws: WebSocket, rid: str):
        if ws.headers.get("origin") and ws.headers["origin"] not in origins:
            await ws.close(code=1008)
            return
        member, forward = None, None
        connection = secrets.token_hex(16)
        try:
            if not await store.allow("connect:" + client_ip(ws), 20, 60):
                await ws.close(code=1008)
                return
            await store.get(rid)
            await ws.accept()
            token = await asyncio.wait_for(ws.receive_text(), 5)
            if len(token) > 128:
                raise HTTPException(401)
            room, member = await store.authorize(rid, token)
            pubsub = redis.pubsub()
            async with pubsub:
                await pubsub.subscribe(prefix + "events:" + rid + ":" + member)
                subscribed = await pubsub.get_message(
                    ignore_subscribe_messages=False, timeout=5
                )
                if not subscribed or subscribed["type"] != "subscribe":
                    raise RuntimeError("Subscription not ready")

                def claim(value):
                    value["members"][member]["connection"] = connection

                room, _ = await store.mutate(rid, claim)
                await ws.send_json(
                    {
                        "type": "authorized",
                        "member": member,
                        "approved": room["members"][member]["approved"],
                    }
                )

                async def deliver():
                    while True:
                        message = await pubsub.get_message(
                            ignore_subscribe_messages=True, timeout=0.5
                        )
                        current = await store.get(rid)
                        if (
                            current["members"].get(member, {}).get("connection")
                            != connection
                        ):
                            await ws.close(code=1008)
                            return
                        if message:
                            data = json.loads(message["data"])
                            if data.get("type") == "revoked":
                                await ws.close(code=1008)
                                return
                            await ws.send_json(data)

                forward = asyncio.create_task(deliver())
                other = "receiver" if member == "owner" else "owner"
                if (
                    "receiver" in room["members"]
                    and not room["members"]["receiver"]["approved"]
                    and room["members"]["receiver"].get("connection")
                ):
                    await store.send(
                        rid, "owner", {"type": "join-request", "member": "receiver"}
                    )
                elif len(room["members"]) == 2 and all(
                    value.get("connection") for value in room["members"].values()
                ):
                    await store.send(rid, "owner", {"type": "ready"})
                while True:
                    try:
                        raw = await asyncio.wait_for(ws.receive_text(), 1)
                    except TimeoutError:
                        if forward.done():
                            await forward
                            break
                        continue
                    if len(raw) > 65536 or not await store.allow(
                        "ws:" + rid + ":" + member, 100, 10
                    ):
                        await ws.close(code=1008)
                        break
                    current, authorized_member = await store.authorize(rid, token)
                    if (
                        authorized_member != member
                        or current["members"][member].get("connection") != connection
                    ):
                        await ws.close(code=1008)
                        break
                    data = json.loads(raw)
                    if not isinstance(data, dict):
                        raise TypeError("Invalid message")
                    if data.get("type") == "approve" and member == "owner":

                        def approve(value):
                            if "receiver" not in value["members"]:
                                raise HTTPException(409)
                            value["members"]["receiver"]["approved"] = True

                        approved, _ = await store.mutate(rid, approve)
                        await store.send(rid, "receiver", {"type": "approved"})
                        if approved["members"]["receiver"].get("connection"):
                            await store.send(rid, "owner", {"type": "ready"})
                    elif (
                        data.get("type") in ("offer", "answer", "ice")
                        and len(current["members"]) == 2
                        and all(v["approved"] for v in current["members"].values())
                    ):
                        field = "candidate" if data["type"] == "ice" else "sdp"
                        payload = data.get(field)
                        if isinstance(payload, dict if field == "candidate" else str):
                            await store.send(
                                rid, other, {"type": data["type"], field: payload}
                            )
        except (
            HTTPException,
            RedisError,
            WebSocketDisconnect,
            TimeoutError,
            ValueError,
            TypeError,
            RuntimeError,
        ) as exc:
            try:
                await ws.close(code=1013 if isinstance(exc, RedisError) else 1008)
            except RuntimeError:
                pass
        finally:
            if forward:
                forward.cancel()
                try:
                    await forward
                except (
                    asyncio.CancelledError,
                    HTTPException,
                    RedisError,
                    RuntimeError,
                ):
                    pass
            if member:
                try:

                    def release(value):
                        if (
                            value["members"].get(member, {}).get("connection")
                            == connection
                        ):
                            value["members"][member]["connection"] = None

                    await store.mutate(rid, release)
                except (HTTPException, RedisError):
                    pass

    return app
