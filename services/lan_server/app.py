"""Authenticated host-mediated LAN transfers. All storage names are generated IDs."""

import asyncio
import hashlib
import json
import os
import secrets
import shutil
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from services.version import BUILD_ID, VERSION
from services.web_security import CSP


class Pair(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=80)


class Offer(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    size: int = Field(ge=0, le=20 * 1024**3)
    recipient: str
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class SaveOutcome(BaseModel):
    outcome: str = Field(pattern=r"^(saved|failed)$")


def create_app(
    storage: Path | None = None,
    host_token: str | None = None,
    connection_url: str | None = None,
    allowed_hosts: list[str] | None = None,
    lan_enabled: bool | None = None,
    online_service=None,
    frontend: Path | None = None,
):
    root = storage or Path(os.getenv("FLOWDROP_STORAGE", ".flowdrop"))
    if root.is_symlink():
        raise RuntimeError("Transfer storage must not be a symlink")
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    host_token = host_token or secrets.token_urlsafe(32)
    code = f"{secrets.randbelow(1000000):06d}"
    code_expiry = time.time() + 600

    def token_key(token):
        return hashlib.sha256(token.encode()).hexdigest()

    session_path = root / "sessions.json"
    sessions = {}
    if session_path.exists():
        sessions = {
            key: value
            for key, value in json.loads(session_path.read_text()).items()
            if value["expires"] > time.time() and value["id"] != "host"
        }
    sessions[token_key(host_token)] = {
        "id": "host",
        "name": "Host",
        "expires": time.time() + 86400,
        "approved": True,
    }
    pending = {s["id"]: key for key, s in sessions.items() if not s["approved"]}
    transfers = {}
    sockets = {}
    attempts = {}
    locks = {}
    downloads = {}
    concurrency = int(os.getenv("FLOWDROP_UPLOAD_CONCURRENCY", "4"))
    if not 1 <= concurrency <= 16:
        raise ValueError("Upload concurrency must be between 1 and 16")
    upload_gate = asyncio.Semaphore(concurrency)
    chunk_size = int(os.getenv("FLOWDROP_CHUNK_SIZE", str(1048576)))
    if chunk_size not in (1048576, 2097152, 4194304):
        raise ValueError("Chunk size must be 1, 2 or 4 MiB")

    def safe_path(tid, name=None):
        directory = root / tid
        target = directory / name if name is not None else directory
        if (
            directory.is_symlink()
            or target.is_symlink()
            or not target.resolve().is_relative_to(root.resolve())
        ):
            raise HTTPException(500, "Unsafe storage path")
        return target

    for metadata in root.glob("*.json"):
        if metadata == session_path:
            continue
        try:
            value = json.loads(metadata.read_text())
            if value["state"] == "VERIFYING":
                value["state"] = "TRANSFERRING"
            if value["state"] in ("ACCEPTED", "TRANSFERRING", "PAUSED"):
                value.pop("started", None)
                value["rate_base"] = value.get("received", 0)
                value["speed"] = 0
            transfers[value["id"]] = value
        except (ValueError, KeyError):
            pass

    def save_sessions():
        temporary = session_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(sessions))
        temporary.replace(session_path)

    async def cleanup():
        while True:
            await asyncio.sleep(60)
            for tid, t in list(transfers.items()):
                if t["created"] < time.time() - 86400:
                    async with locks.setdefault(tid, asyncio.Lock()):
                        t["state"] = "EXPIRED"
                        shutil.rmtree(root / tid, ignore_errors=True)
                        (root / (tid + ".json")).unlink(missing_ok=True)
                        transfers.pop(tid, None)
            for key, s in list(sessions.items()):
                if s["expires"] < time.time():
                    sessions.pop(key, None)
                    pending.pop(s["id"], None)
                    ws = sockets.pop(s["id"], None)
                    if ws:
                        await ws.close(code=1008)
            save_sessions()
            for tid, ticket in list(downloads.items()):
                if ticket["expires"] < time.time():
                    downloads.pop(tid, None)

    @asynccontextmanager
    async def lifespan(app):
        task = asyncio.create_task(cleanup())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    app = FastAPI(
        title="FlowDrop LAN",
        version=VERSION,
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
    )
    if allowed_hosts is not None:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)

    def save(t):
        target = root / (t["id"] + ".json")
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps(t))
        temporary.replace(target)

    def auth(request: Request):
        token = request.headers.get("authorization", "").removeprefix("Bearer ")
        s = sessions.get(token_key(token))
        if not s or not s["approved"] or s["expires"] < time.time():
            raise HTTPException(401, "Session expired or unauthorized")
        return s

    def owned(tid, s):
        t = transfers.get(tid)
        if not t or s["id"] not in (t["sender"], t["recipient"]):
            raise HTTPException(404, "Transfer not found")
        return t

    async def notify():
        for device, ws in list(sockets.items()):
            try:
                await ws.send_json({"type": "refresh"})
            except (RuntimeError, OSError, WebSocketDisconnect):
                sockets.pop(device, None)

    @app.middleware("http")
    async def origin_guard(request, call_next):
        if request.method in ("POST", "PUT"):
            length = request.headers.get("content-length")
            maximum = 4194304 if "/chunks/" in request.url.path else 131072
            if length is None or not length.isdecimal():
                return JSONResponse({"detail": "Content-Length required"}, 411)
            if int(length) > maximum:
                return JSONResponse({"detail": "Request too large"}, 413)
        origin = request.headers.get("origin")
        if origin and origin != str(request.base_url).rstrip("/"):
            return __import__(
                "starlette.responses", fromlist=["JSONResponse"]
            ).JSONResponse({"detail": "Cross-origin request denied"}, 403)
        response = await call_next(request)
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = CSP
        response.headers["Cache-Control"] = "no-store"
        return response

    if online_service is not None:

        class OnlineSettings(BaseModel):
            website: str = Field(max_length=512)
            signaling: str = Field(default="", max_length=512)

        @app.get("/api/online/config")
        def online_status():
            return online_service.status()

        @app.post("/api/online/config")
        def online_settings(body: OnlineSettings, request: Request):
            if auth(request)["id"] != "host":
                raise HTTPException(403, "Only the host can configure online services")
            try:
                return online_service.save(body.website, body.signaling)
            except ValueError as exc:
                raise HTTPException(400, str(exc)) from exc

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "mode": "lan",
            "chunk_size": chunk_size,
            "version": VERSION,
            "build": BUILD_ID,
        }

    @app.get("/api/session")
    async def session(request: Request):
        s = auth(request)
        return {
            **s,
            "pairing_code": code if s["id"] == "host" else None,
            "connection_url": connection_url if s["id"] == "host" else None,
            "lan_enabled": lan_enabled if s["id"] == "host" else None,
        }

    @app.post("/api/pair")
    async def pair(body: Pair, request: Request):
        ip = request.client.host
        entries = [x for x in attempts.get(ip, []) if x > time.time() - 60]
        attempts[ip] = entries + [time.time()]
        if len(attempts) > 10000:
            attempts.clear()
        if len(entries) >= 5:
            raise HTTPException(429, "Wait before retrying")
        if body.code != code or time.time() > code_expiry:
            raise HTTPException(
                403, "Invalid or expired pairing code; restart host to renew"
            )
        if len(sessions) >= 100:
            raise HTTPException(429, "Device limit reached")
        token = secrets.token_urlsafe(32)
        device = secrets.token_hex(16)
        sessions[token_key(token)] = {
            "id": device,
            "name": body.name,
            "expires": time.time() + 600,
            "approved": False,
        }
        pending[device] = token_key(token)
        save_sessions()
        return {"token": token, "id": device, "status": "pending"}

    @app.post("/api/pair/renew")
    async def renew(request: Request):
        nonlocal code, code_expiry
        if auth(request)["id"] != "host":
            raise HTTPException(403)
        code = f"{secrets.randbelow(1000000):06d}"
        code_expiry = time.time() + 600
        app.state.pairing_code = code
        return {"pairing_code": code}

    @app.get("/api/devices")
    async def devices(request: Request):
        s = auth(request)
        return [
            v
            for v in sessions.values()
            if v["expires"] > time.time() and (v["approved"] or s["id"] == "host")
        ]

    @app.post("/api/devices/{device}/approve")
    async def approve(device: str, request: Request):
        if auth(request)["id"] != "host":
            raise HTTPException(403)
        token = pending.pop(device, None)
        if not token:
            raise HTTPException(404)
        sessions[token]["approved"] = True
        sessions[token]["expires"] = time.time() + 86400
        save_sessions()
        await notify()
        return {"status": "approved"}

    @app.delete("/api/devices/{device}")
    async def revoke(device: str, request: Request):
        if auth(request)["id"] != "host" or device == "host":
            raise HTTPException(403)
        for token, s in list(sessions.items()):
            if s["id"] == device:
                del sessions[token]
        save_sessions()
        ws = sockets.pop(device, None)
        if ws:
            await ws.close()
        return {"status": "revoked"}

    @app.get("/api/transfers")
    async def listing(request: Request):
        s = auth(request)
        return [
            {key: value for key, value in t.items() if key != "chunks"}
            for t in transfers.values()
            if s["id"] in (t["sender"], t["recipient"])
        ]

    @app.get("/api/transfers/{tid}")
    async def checkpoint(tid: str, request: Request):
        s = auth(request)
        t = owned(tid, s)
        return {
            **{key: value for key, value in t.items() if key != "chunks"},
            "completed_chunks": [int(index) for index in t["chunks"]]
            if s["id"] == t["sender"]
            else [],
        }

    @app.post("/api/transfers")
    async def offer(body: Offer, request: Request):
        s = auth(request)
        if len(transfers) >= 1000:
            raise HTTPException(
                429, "Transfer history limit reached; wait for expiry cleanup"
            )
        if not any(
            v["id"] == body.recipient and v["approved"] and v["expires"] > time.time()
            for v in sessions.values()
        ):
            raise HTTPException(404, "Recipient unavailable")
        if (
            sum(t["size"] for t in transfers.values() if t["state"] != "CANCELLED")
            + body.size
            > 50 * 1024**3
        ):
            raise HTTPException(507, "Host storage quota exceeded")
        reserved = sum(
            t["size"] * 2
            for t in transfers.values()
            if t["state"] not in ("COMPLETED", "FAILED", "CANCELLED")
        )
        if shutil.disk_usage(root).free < body.size * 2 + reserved + 100 * 1024**2:
            raise HTTPException(507, "Insufficient host disk space")
        if (
            len(
                [
                    t
                    for t in transfers.values()
                    if t["state"] not in ("COMPLETED", "CANCELLED", "FAILED")
                ]
            )
            >= 100
        ):
            raise HTTPException(429, "Transfer queue full")
        name = (
            body.name.replace("\\", "/")
            .split("/")[-1]
            .replace("\r", "")
            .replace("\n", "")
        )
        tid = secrets.token_hex(16)
        t = {
            **body.model_dump(),
            "name": name or "file",
            "id": tid,
            "sender": s["id"],
            "state": "PENDING",
            "chunks": {},
            "created": time.time(),
            "chunk_size": chunk_size,
        }
        transfers[tid] = t
        save(t)
        await notify()
        return t

    @app.post("/api/transfers/{tid}/accept")
    async def accept(tid: str, request: Request):
        s = auth(request)
        t = owned(tid, s)
        if s["id"] != t["recipient"] or t["state"] != "PENDING":
            raise HTTPException(409)
        t["state"] = "ACCEPTED"
        save(t)
        await notify()
        return t

    @app.post("/api/transfers/{tid}/pause")
    async def pause(tid: str, request: Request):
        t = owned(tid, auth(request))
        async with locks.setdefault(tid, asyncio.Lock()):
            if t["state"] not in ("ACCEPTED", "TRANSFERRING"):
                raise HTTPException(409)
            t["state"] = "PAUSED"
            save(t)
        await notify()
        return t

    @app.post("/api/transfers/{tid}/resume")
    async def resume(tid: str, request: Request):
        t = owned(tid, auth(request))
        async with locks.setdefault(tid, asyncio.Lock()):
            if t["state"] != "PAUSED":
                raise HTTPException(409)
            t["state"] = "TRANSFERRING"
            t.pop("started", None)
            t["rate_base"] = t.get("received", 0)
            t["speed"] = 0
            save(t)
        await notify()
        return t

    @app.put("/api/transfers/{tid}/chunks/{index}")
    async def chunk(tid: str, index: int, request: Request):
        s = auth(request)
        t = owned(tid, s)
        async with upload_gate, locks.setdefault(tid, asyncio.Lock()):
            if s["id"] != t["sender"] or t["state"] not in ("ACCEPTED", "TRANSFERRING"):
                raise HTTPException(409)
            size = t.get("chunk_size", 1048576)
            expected = min(size, t["size"] - index * size)
            if index < 0 or expected <= 0:
                raise HTTPException(400, "Invalid chunk")
            directory = safe_path(tid)
            directory.mkdir(exist_ok=True)
            temporary = safe_path(tid, f"{index}.partial")
            length = 0
            digest = hashlib.sha256()
            try:
                t.setdefault("started", time.time())
                async with asyncio.timeout(60):
                    with temporary.open("wb") as out:
                        async for data in request.stream():
                            auth(request)
                            length += len(data)
                            if length > expected:
                                raise HTTPException(413)
                            out.write(data)
                            digest.update(data)
                if length != expected:
                    raise HTTPException(400, "Incomplete chunk")
                hexdigest = digest.hexdigest()
                if str(index) in t["chunks"] and t["chunks"][str(index)] != hexdigest:
                    raise HTTPException(409, "Conflicting duplicate chunk")
                temporary.replace(safe_path(tid, str(index)))
                t["chunks"][str(index)] = hexdigest
                t["received"] = sum(
                    min(size, t["size"] - int(i) * size) for i in t["chunks"]
                )
                t["speed"] = max(0, t["received"] - t.get("rate_base", 0)) / max(
                    0.001, time.time() - t["started"]
                )
                t["state"] = "TRANSFERRING"
                save(t)
            except TimeoutError as exc:
                raise HTTPException(
                    408, "Chunk upload timed out; reconnect and retry"
                ) from exc
            except OSError as exc:
                raise HTTPException(
                    507,
                    "Host storage write failed; free disk space or check permissions, then retry",
                ) from exc
            finally:
                temporary.unlink(missing_ok=True)
        return {"index": index, "sha256": hexdigest}

    @app.post("/api/transfers/{tid}/finish")
    async def finish(tid: str, request: Request):
        t = owned(tid, auth(request))
        if auth(request)["id"] != t["sender"]:
            raise HTTPException(403)
        async with locks.setdefault(tid, asyncio.Lock()):
            if t["state"] not in ("ACCEPTED", "TRANSFERRING"):
                raise HTTPException(409)
            size = t.get("chunk_size", 1048576)
            count = (t["size"] + size - 1) // size
            if any(str(i) not in t["chunks"] for i in range(count)):
                raise HTTPException(409, "Missing chunks")
            t["state"] = "VERIFYING"
            save(t)

            def assemble():
                directory = safe_path(tid)
                directory.mkdir(exist_ok=True)
                digest = hashlib.sha256()
                with safe_path(tid, "payload").open("wb") as out:
                    for i in range(count):
                        with safe_path(tid, str(i)).open("rb") as src:
                            while data := src.read(65536):
                                digest.update(data)
                                out.write(data)
                return digest.hexdigest()

            try:
                digest = await asyncio.to_thread(assemble)
            except OSError as exc:
                safe_path(tid, "payload").unlink(missing_ok=True)
                t["state"] = "TRANSFERRING"
                save(t)
                await notify()
                raise HTTPException(
                    507, "Assembly failed; free host storage and retry verification"
                ) from exc
            t["state"] = "COMPLETED" if digest == t["sha256"] else "FAILED"
            save(t)
            await notify()
            if t["state"] == "FAILED":
                raise HTTPException(422, "Integrity verification failed")
            for index in range(count):
                safe_path(tid, str(index)).unlink(missing_ok=True)
            return t

    @app.delete("/api/transfers/{tid}")
    async def cancel(tid: str, request: Request):
        t = owned(tid, auth(request))
        async with locks.setdefault(tid, asyncio.Lock()):
            t["state"] = "CANCELLED"
            save(t)
            import shutil

            shutil.rmtree(root / tid, ignore_errors=True)
        await notify()
        return t

    @app.post("/api/transfers/{tid}/download-ticket")
    async def download_ticket(tid: str, request: Request):
        s = auth(request)
        t = owned(tid, s)
        if s["id"] != t["recipient"] or t["state"] != "COMPLETED":
            raise HTTPException(403)
        capability = secrets.token_urlsafe(32)
        downloads[tid] = {
            "digest": token_key(capability),
            "device": s["id"],
            "expires": time.time() + 600,
        }
        response = JSONResponse({"status": "ready"})
        response.set_cookie(
            "flowdrop_download",
            capability,
            max_age=600,
            path=f"/api/transfers/{tid}/download",
            httponly=True,
            samesite="strict",
            secure=request.url.scheme == "https",
        )
        return response

    @app.post("/api/transfers/{tid}/save-outcome")
    async def save_outcome(tid: str, body: SaveOutcome, request: Request):
        s = auth(request)
        t = owned(tid, s)
        if t["recipient"] != s["id"] or t["state"] != "COMPLETED":
            raise HTTPException(403)
        t["save_outcome"] = body.outcome
        t["save_reported_at"] = time.time()
        save(t)
        await notify()
        return {"outcome": body.outcome, "source": "receiver-report"}

    @app.get("/api/transfers/{tid}/download")
    async def download(tid: str, request: Request):
        ticket = downloads.get(tid)
        if request.headers.get("authorization"):
            s = auth(request)
        elif (
            ticket
            and ticket["expires"] > time.time()
            and secrets.compare_digest(
                token_key(request.cookies.get("flowdrop_download", "")),
                ticket["digest"],
            )
        ):
            s = next(
                (
                    s
                    for s in sessions.values()
                    if s["id"] == ticket["device"]
                    and s["approved"]
                    and s["expires"] > time.time()
                ),
                None,
            )
            if not s:
                raise HTTPException(401)
        else:
            raise HTTPException(401)
        t = owned(tid, s)
        if s["id"] != t["recipient"] or t["state"] != "COMPLETED":
            raise HTTPException(403)
        return FileResponse(
            safe_path(tid, "payload"),
            filename=t["name"],
            media_type="application/octet-stream",
        )

    @app.websocket("/api/ws")
    async def websocket(ws: WebSocket):
        origin = ws.headers.get("origin")
        if origin and origin != str(ws.url).split("/api/ws")[0].replace(
            "ws://", "http://"
        ).replace("wss://", "https://"):
            await ws.close(code=1008)
            return
        await ws.accept()
        device = None
        try:
            token = await asyncio.wait_for(ws.receive_text(), 5)
            s = sessions.get(token_key(token))
            if not s or not s["approved"] or s["expires"] < time.time():
                await ws.close(code=1008)
                return
            device = s["id"]
            sockets[device] = ws
            while True:
                data = await ws.receive_json()
                if not isinstance(data, dict):
                    await ws.close(code=1008)
                    break
                if sessions.get(token_key(token)) != s or s["expires"] < time.time():
                    await ws.close(code=1008)
                    break
                if (
                    data.get("type") == "text"
                    and isinstance(data.get("text"), str)
                    and len(data["text"]) <= 65536
                ):
                    recipient = sockets.get(data.get("recipient"))
                    if recipient:
                        await recipient.send_json(
                            {"type": "text", "sender": s["name"], "text": data["text"]}
                        )
        except (TimeoutError, WebSocketDisconnect, ValueError):
            pass
        finally:
            if device and sockets.get(device) is ws:
                sockets.pop(device, None)

    dist = frontend or (
        Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
        / "apps/web/dist"
    )
    if dist.exists():
        app.mount("/", StaticFiles(directory=dist, html=True), name="web")
    app.state.host_token = host_token
    app.state.pairing_code = code
    return app
