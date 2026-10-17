"""Version 2 named, bounded multi-member rooms for a single signaling instance.

Display names are never identities. Tokens stay out of URLs and room snapshots.
Legacy two-peer routes remain available for existing desktop clients.
"""

import asyncio
import hashlib
import hmac
import json
import secrets
import time
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, field_validator

from services.request_security import client_ip
from services.signaling.ice import ice_configuration


class DeviceName(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    kind: Literal["computer", "phone", "tablet"] = "computer"

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        value = value.strip()
        if not 1 <= len(value) <= 32 or any(
            ord(c) < 32 or ord(c) == 127 for c in value
        ):
            raise ValueError(
                "Use a device name of 1–32 characters without control characters"
            )
        return value


def install_rooms(app, allowed):
    router = APIRouter(prefix="/v2")
    rooms, codes, limits = {}, {}, {}
    ttl = 3600
    app.state.room_clock = lambda: time.time()

    def now():
        return app.state.room_clock()

    def issue_code():
        for _ in range(32):
            value = f"{secrets.randbelow(1000000):06d}"
            if value not in codes:
                return value
        raise HTTPException(503, "Invitation capacity reached")

    def rotate(rid, room, force=False):
        if not force and room["code_expires"] > now():
            return False
        code = issue_code()
        old = room["code"]
        codes[code] = rid
        room["code"], room["code_expires"] = code, now() + 600
        codes.pop(old, None)
        return True

    def rate(request, bucket="join", maximum=20):
        stamp = now()
        key = (client_ip(request), bucket)
        recent = [t for t in limits.get(key, []) if t > stamp - 60]
        if len(recent) >= maximum:
            raise HTTPException(
                429,
                "Too many attempts. Wait a minute and retry.",
                headers={"Retry-After": "60"},
            )
        if len(limits) >= 10000 and key not in limits:
            raise HTTPException(503, "Try again later")
        limits[key] = recent + [stamp]
        if request.headers.get("origin") and request.headers["origin"] not in allowed:
            raise HTTPException(403, "Origin denied")
        # Reap expired rooms on every request; socket readers also enforce expiry.
        for rid, room in list(rooms.items()):
            if room["expires"] <= stamp:
                rooms.pop(rid, None)
                codes.pop(room["code"], None)

    def get_room(rid):
        room = rooms.get(rid)
        if not room or room["expires"] <= now():
            raise HTTPException(404, "Room expired or ended")
        return room

    def authorize(room, token):
        digest = hashlib.sha256(token.encode()).hexdigest()
        member = next(
            (
                m
                for m in room["members"].values()
                if hmac.compare_digest(m["digest"], digest)
            ),
            None,
        )
        if not member:
            raise HTTPException(403, "Room membership required")
        return member

    def public(room):
        return {
            "type": "members",
            "owner": room["owner"],
            "locked": room["locked"],
            "code": room["code"],
            "code_expires": room["code_expires"],
            "expires": room["expires"],
            "members": [
                {
                    "id": m["id"],
                    "name": m["name"],
                    "online": m["id"] in room["sockets"],
                    "kind": m["kind"],
                }
                for m in room["members"].values()
            ],
        }

    async def broadcast(room, event=None):
        payload = {**public(room), "event": event}
        for ws in list(room["sockets"].values()):
            try:
                await asyncio.wait_for(ws.send_json(payload), 3)
            except (RuntimeError, TimeoutError, WebSocketDisconnect):
                pass

    async def rotate_due():
        for rid, room in list(rooms.items()):
            if room["expires"] > now() and rotate(rid, room):
                await broadcast(room, "invitation")

    app.state.rotate_invitations = rotate_due

    def member(room, name, kind):
        mid, token = secrets.token_hex(12), secrets.token_urlsafe(32)
        room["members"][mid] = {
            "id": mid,
            "name": name,
            "kind": kind,
            "digest": hashlib.sha256(token.encode()).hexdigest(),
        }
        return {"member": mid, "token": token}

    @router.get("/health")
    def health():
        return {
            "status": "ok",
            "protocol": 2,
            "revision": "workspace-v3-20261016",
            "topology": "addressed-mesh",
            "maxMembers": 8,
            "hostControls": True,
            "manualInvitationRefresh": True,
            "state": "single-instance-memory",
            "invitationRotationSeconds": 600,
            "idleRoomSeconds": ttl,
            "maxRoomSeconds": 86400,
        }

    @router.post("/rooms")
    async def create(body: DeviceName, request: Request):
        rate(request, "create")
        if len(rooms) >= 1000:
            raise HTTPException(503, "Room capacity reached")
        code = issue_code()
        rid = secrets.token_hex(16)
        room = {
            "members": {},
            "sockets": {},
            "locked": False,
            "code": code,
            "code_expires": now() + 600,
            "expires": now() + ttl,
            "absolute_expires": now() + 86400,
        }
        identity = member(room, body.name, body.kind)
        room["owner"] = identity["member"]
        rooms[rid], codes[code] = room, rid
        return {"room": rid, **identity, **public(room)}

    @router.post("/rooms/{code}/join")
    async def join(code: str, body: DeviceName, request: Request):
        rate(request)
        if len(code) != 6 or not code.isascii() or not code.isdigit():
            raise HTTPException(404, "Room code unavailable")
        rid = codes.get(code)
        room = get_room(rid)
        if room["code_expires"] <= now():
            raise HTTPException(404, "Invitation expired")
        if room["locked"]:
            raise HTTPException(423, "Room is locked")
        if len(room["members"]) >= 8:
            raise HTTPException(409, "Room is full (8 devices)")
        identity = member(room, body.name, body.kind)
        await broadcast(room, "joined")
        return {"room": rid, **identity, **public(room)}

    @router.get("/rooms/{rid}/ice")
    async def ice(rid: str, request: Request):
        rate(request, "ice", 60)
        authorize(
            get_room(rid),
            request.headers.get("authorization", "").removeprefix("Bearer "),
        )
        return ice_configuration()

    @router.delete("/rooms/{rid}/membership")
    async def leave(rid: str, request: Request):
        rate(request, "leave", 60)
        room = get_room(rid)
        identity = authorize(
            room, request.headers.get("authorization", "").removeprefix("Bearer ")
        )
        if identity["id"] == room["owner"]:
            rooms.pop(rid, None)
            codes.pop(room["code"], None)
            for ws in list(room["sockets"].values()):
                await ws.close(code=4001, reason="Room ended")
            return {"status": "ended"}
        room["members"].pop(identity["id"])
        ws = room["sockets"].pop(identity["id"], None)
        if ws:
            await ws.close(code=4001, reason="Left room")
        await broadcast(room, "left")
        return {"status": "left"}

    def host(room, request):
        identity = authorize(
            room, request.headers.get("authorization", "").removeprefix("Bearer ")
        )
        if identity["id"] != room["owner"]:
            raise HTTPException(403, "Host required")
        return identity

    @router.post("/rooms/{rid}/invitation")
    async def refresh_invitation(rid: str, request: Request):
        rate(request, "invitation", 6)
        room = get_room(rid)
        host(room, request)
        rotate(rid, room, force=True)
        await broadcast(room, "invitation")
        return public(room)

    @router.delete("/rooms/{rid}/members/{mid}")
    async def remove_member(rid: str, mid: str, request: Request):
        rate(request, "remove", 20)
        room = get_room(rid)
        host(room, request)
        if mid == room["owner"]:
            raise HTTPException(400, "Host cannot remove themselves")
        if mid not in room["members"]:
            raise HTTPException(404, "Device already left")
        # Revoke before yielding: the old token can no longer authenticate or signal.
        room["members"].pop(mid)
        target = room["sockets"].pop(mid, None)
        if target:
            try:
                await asyncio.wait_for(
                    target.close(code=4003, reason="Removed by host"), 3
                )
            except (RuntimeError, TimeoutError, WebSocketDisconnect):
                pass
        await broadcast(room, "removed")
        return {"status": "removed"}

    @router.websocket("/rooms/{rid}/ws")
    async def socket(ws: WebSocket, rid: str):
        if ws.headers.get("origin") not in allowed:
            await ws.close(code=1008)
            return
        try:
            room = get_room(rid)
        except HTTPException:
            await ws.close(code=4001)
            return
        await ws.accept()
        identity = None
        try:
            identity = authorize(room, await asyncio.wait_for(ws.receive_text(), 5))
            mid = identity["id"]
            previous = room["sockets"].get(mid)
            room["sockets"][mid] = ws
            if previous:
                await previous.close(code=4002, reason="Session opened elsewhere")
            await broadcast(room, "connected")
            stamps = []
            while True:
                remaining = room["expires"] - now()
                if remaining <= 0 or rooms.get(rid) is not room:
                    await ws.close(code=4001, reason="Room expired")
                    break
                if rotate(rid, room):
                    await broadcast(room, "invitation")
                try:
                    raw = await asyncio.wait_for(
                        ws.receive_text(),
                        min(30, remaining, max(0.1, room["code_expires"] - now())),
                    )
                except TimeoutError:
                    await ws.send_json({"type": "pong"})
                    continue
                if room["members"].get(mid) is not identity:
                    await ws.close(code=4003, reason="Removed by host")
                    break
                if len(raw) > 65536:
                    await ws.close(code=1009)
                    break
                stamp = now()
                stamps = [t for t in stamps if t > stamp - 10]
                if len(stamps) >= 200:
                    await ws.close(code=1008)
                    break
                stamps.append(stamp)
                data = json.loads(raw)
                if not isinstance(data, dict):
                    raise TypeError("Invalid event")
                kind = data.get("type")
                # A valid authenticated heartbeat or signal refreshes idle lifetime.
                room["expires"] = min(now() + ttl, room["absolute_expires"])
                if kind == "ping":
                    await ws.send_json({"type": "pong"})
                elif kind == "rename":
                    # The authenticated identity is the only rename target.
                    if set(data) != {"type", "name"}:
                        await ws.send_json(
                            {
                                "type": "error",
                                "message": "Only your own device can be renamed",
                            }
                        )
                        continue
                    try:
                        identity["name"] = DeviceName(name=data.get("name")).name
                    except ValueError:
                        await ws.send_json(
                            {
                                "type": "error",
                                "message": "Use a device name of 1–32 characters",
                            }
                        )
                        continue
                    await broadcast(room, "renamed")
                elif kind == "lock":
                    if mid != room["owner"] or not isinstance(data.get("locked"), bool):
                        await ws.send_json(
                            {"type": "error", "message": "Creator required"}
                        )
                        continue
                    room["locked"] = data["locked"]
                    await broadcast(room, "locked")
                elif kind in ("offer", "answer", "ice", "retry"):
                    target = data.get("to")
                    if (
                        not isinstance(target, str)
                        or target == mid
                        or target not in room["members"]
                    ):
                        await ws.send_json(
                            {"type": "error", "message": "Recipient unavailable"}
                        )
                        continue
                    field = "candidate" if kind == "ice" else "sdp"
                    payload = data.get(field)
                    if kind != "retry" and not (
                        (field == "sdp" and isinstance(payload, str))
                        or (field == "candidate" and isinstance(payload, dict))
                    ):
                        continue
                    peer = room["sockets"].get(target)
                    if peer:
                        # Never forward user-supplied sender IDs or other fields.
                        await asyncio.wait_for(
                            peer.send_json({"type": kind, "from": mid, field: payload}),
                            3,
                        )
        except (
            TimeoutError,
            WebSocketDisconnect,
            HTTPException,
            ValueError,
            TypeError,
            RuntimeError,
        ):
            pass
        finally:
            if identity and room["sockets"].get(identity["id"]) is ws:
                room["sockets"].pop(identity["id"], None)
                await broadcast(room, "disconnected")
            try:
                await ws.close(code=4001 if room["expires"] <= now() else 1000)
            except RuntimeError:
                pass

    app.include_router(router)
