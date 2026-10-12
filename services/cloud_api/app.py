"""Ciphertext-only temporary storage. Production uses PostgreSQL and private S3."""

import asyncio
import hashlib
import logging
import os
import secrets
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import NamedTemporaryFile

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import (
    BigInteger,
    Boolean,
    Float,
    Integer,
    String,
    create_engine,
    inspect,
    select,
    text,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class Share(Base):
    __tablename__ = "shares"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    upload_hash: Mapped[str] = mapped_column(String(64))
    download_hash: Mapped[str] = mapped_column(String(64))
    chunks: Mapped[int] = mapped_column(Integer)
    bytes_limit: Mapped[int] = mapped_column(BigInteger)
    expires: Mapped[float] = mapped_column(Float)
    ready: Mapped[bool] = mapped_column(Boolean, default=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Chunk(Base):
    __tablename__ = "chunks"
    share_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    index: Mapped[int] = mapped_column(Integer, primary_key=True)
    digest: Mapped[str] = mapped_column(String(64))
    size: Mapped[int] = mapped_column(Integer)


class Create(BaseModel):
    chunks: int = Field(ge=1, le=20481)
    bytes_limit: int = Field(ge=16, le=20 * 1024**3)
    ttl: int = Field(ge=60, le=86400 * 7)


class LocalStore:
    """Explicit test/development adapter; never public buckets."""

    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)

    def put(self, key, path):
        import shutil

        shutil.copyfile(path, self.root / key)

    def response(self, key):
        return FileResponse(self.root / key, media_type="application/octet-stream")

    def delete(self, key):
        (self.root / key).unlink(missing_ok=True)

    def delete_share(self, sid):
        for path in self.root.glob(sid + "-*"):
            path.unlink(missing_ok=True)


class S3Store:
    def __init__(self):
        import boto3

        self.client = boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT"))
        self.bucket = os.environ["S3_BUCKET"]

    def put(self, key, path):
        self.client.upload_file(
            str(path),
            self.bucket,
            key,
            ExtraArgs={"ContentType": "application/octet-stream"},
        )

    def response(self, key):
        body = self.client.get_object(Bucket=self.bucket, Key=key)["Body"]

        def stream():
            try:
                while data := body.read(65536):
                    yield data
            finally:
                body.close()

        return StreamingResponse(stream(), media_type="application/octet-stream")

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def delete_share(self, sid):
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=sid + "-"):
            objects = [{"Key": item["Key"]} for item in page.get("Contents", [])]
            if objects:
                response = self.client.delete_objects(
                    Bucket=self.bucket, Delete={"Objects": objects, "Quiet": True}
                )
                if response.get("Errors"):
                    raise OSError("Storage deletion incomplete")


def create_app(database: str | None = None, store=None, quota_bytes: int | None = None):
    database = database or os.environ["DATABASE_URL"]
    engine = create_engine(
        database,
        connect_args={"check_same_thread": False}
        if database.startswith("sqlite")
        else {},
    )
    if database.startswith("sqlite"):
        Base.metadata.create_all(engine)
    elif not {"shares", "chunks"}.issubset(set(inspect(engine).get_table_names())):
        raise RuntimeError(
            "Apply cloud database migrations before starting: python -m alembic upgrade head"
        )
    factory = sessionmaker(engine, expire_on_commit=False)
    store = store or S3Store()
    attempts = {}
    quota_bytes = (
        quota_bytes
        if quota_bytes is not None
        else int(os.getenv("FLOWDROP_CLOUD_QUOTA_BYTES", str(100 * 1024**3)))
    )
    if quota_bytes < 16:
        raise ValueError("Cloud quota must allow at least one authentication tag")
    rate_lock = threading.Lock()
    locks = {}

    def key(sid, index):
        return f"{sid}-{index}"

    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def authorize(db, sid, request, upload=False, expired=False):
        statement = select(Share).where(Share.id == sid)
        share = db.scalar(statement.with_for_update() if upload else statement)
        supplied = request.headers.get("authorization", "").removeprefix("Bearer ")
        expected = (
            share.upload_hash
            if share and upload
            else share.download_hash
            if share
            else ""
        )
        if not share or not secrets.compare_digest(digest(supplied), expected):
            raise HTTPException(404, "Share unavailable")
        if not expired and (share.revoked or share.expires < time.time()):
            raise HTTPException(410, "Share expired or revoked")
        return share

    def clean():
        with factory() as db:
            shares = db.scalars(
                select(Share)
                .where((Share.expires < time.time()) | Share.revoked)
                .with_for_update()
            ).all()
            for share in shares:
                store.delete_share(share.id)
                chunks = db.scalars(
                    select(Chunk).where(Chunk.share_id == share.id)
                ).all()
                for chunk in chunks:
                    db.delete(chunk)
                db.delete(share)
            db.commit()

    @asynccontextmanager
    async def lifespan(app):
        async def loop():
            while True:
                await asyncio.sleep(60)
                try:
                    await asyncio.to_thread(clean)
                except (OSError, SQLAlchemyError, BotoCoreError, ClientError):
                    logging.getLogger("flowdrop.cloud").warning(
                        '{"event":"storage_cleanup_failed","retry_in_seconds":60}'
                    )

        task = asyncio.create_task(loop())
        yield
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    app = FastAPI(title="FlowDrop encrypted Send Later", lifespan=lifespan)

    @app.middleware("http")
    async def protect(request, call_next):
        from starlette.responses import JSONResponse

        origin = request.headers.get("origin")
        if request.method in ("POST", "PUT"):
            length = request.headers.get("content-length")
            maximum = 1048576 + 16 if "/chunks/" in request.url.path else 16384
            if length is None or not length.isdecimal():
                return JSONResponse({"detail": "Content-Length required"}, 411)
            if int(length) > maximum:
                return JSONResponse({"detail": "Request too large"}, 413)
        if origin and origin != str(request.base_url).rstrip("/"):
            return JSONResponse({"detail": "Origin denied"}, 403)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "encrypted-storage"}

    @app.post("/shares")
    def create(body: Create, request: Request):
        ip = request.client.host
        now = time.time()
        with rate_lock:
            entries = [t for t in attempts.get(ip, []) if t > now - 3600]
            if len(entries) >= 10:
                raise HTTPException(429, "Hourly share limit reached")
            attempts[ip] = entries + [now]
            if len(attempts) > 10000:
                attempts.clear()
        with factory() as db:
            from sqlalchemy import func

            if engine.dialect.name == "postgresql":
                db.execute(text("SELECT pg_advisory_xact_lock(73140241)"))
            elif engine.dialect.name == "sqlite":
                db.execute(text("BEGIN IMMEDIATE"))

            reserved = db.scalar(select(func.sum(Share.bytes_limit))) or 0
            if reserved + body.bytes_limit > quota_bytes:
                raise HTTPException(507, "Storage quota exceeded")
            sid = secrets.token_hex(24)
            upload = secrets.token_urlsafe(32)
            download = secrets.token_urlsafe(32)
            db.add(
                Share(
                    id=sid,
                    upload_hash=digest(upload),
                    download_hash=digest(download),
                    chunks=body.chunks,
                    bytes_limit=body.bytes_limit,
                    expires=now + body.ttl,
                    ready=False,
                    revoked=False,
                )
            )
            db.commit()
        return {
            "id": sid,
            "upload_token": upload,
            "download_token": download,
            "expires": now + body.ttl,
        }

    @app.put("/shares/{sid}/chunks/{index}")
    async def upload(sid: str, index: int, request: Request):
        async with locks.setdefault(sid, asyncio.Lock()):
            with factory() as db:
                share = authorize(db, sid, request, True)
                if share.ready or index < 0 or index >= share.chunks:
                    raise HTTPException(409, "Upload closed or invalid index")
                size = 0
                hasher = hashlib.sha256()
                with NamedTemporaryFile(delete=False) as temporary:
                    path = Path(temporary.name)
                    try:
                        async for data in request.stream():
                            size += len(data)
                            if size > 1048576 + 16:
                                raise HTTPException(413, "Ciphertext chunk too large")
                            temporary.write(data)
                            hasher.update(data)
                    except BaseException:
                        temporary.close()
                        path.unlink(missing_ok=True)
                        raise
                try:
                    if size < 16:
                        raise HTTPException(400, "Missing authentication tag")
                    checksum = hasher.hexdigest()
                    old = db.get(Chunk, (sid, index))
                    if old and old.digest != checksum:
                        raise HTTPException(409, "Conflicting duplicate ciphertext")
                    total = sum(
                        c.size
                        for c in db.scalars(select(Chunk).where(Chunk.share_id == sid))
                    )
                    if total + size - (old.size if old else 0) > share.bytes_limit:
                        raise HTTPException(413, "Upload quota exceeded")
                    if not old:
                        await asyncio.to_thread(store.put, key(sid, index), path)
                        db.add(
                            Chunk(share_id=sid, index=index, size=size, digest=checksum)
                        )
                        db.commit()
                    return {"index": index, "sha256": checksum}
                finally:
                    path.unlink(missing_ok=True)

    @app.post("/shares/{sid}/finish")
    def finish(sid: str, request: Request):
        with factory() as db:
            share = authorize(db, sid, request, True)
            chunks = db.scalars(select(Chunk).where(Chunk.share_id == sid)).all()
            if len(chunks) != share.chunks:
                raise HTTPException(409, "Missing chunks")
            share.ready = True
            db.commit()
        return {"status": "ready"}

    @app.get("/shares/{sid}")
    def info(sid: str, request: Request):
        with factory() as db:
            share = authorize(db, sid, request)
            if not share.ready:
                raise HTTPException(409, "Upload incomplete")
            return {"chunks": share.chunks, "expires": share.expires}

    @app.get("/shares/{sid}/chunks/{index}")
    def download(sid: str, index: int, request: Request):
        with factory() as db:
            share = authorize(db, sid, request)
            if not share.ready or not db.get(Chunk, (sid, index)):
                raise HTTPException(404, "Chunk unavailable")
            return store.response(key(sid, index))

    @app.delete("/shares/{sid}")
    def revoke(sid: str, request: Request):
        with factory() as db:
            share = authorize(db, sid, request, True, True)
            share.revoked = True
            db.commit()
        clean()
        return {"status": "revoked"}

    app.state.cleanup = clean
    app.state.engine = engine
    return app
