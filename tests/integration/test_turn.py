"""Real local TURN Allocate authentication; not an Internet relay test."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import socket
import struct
import time
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    not os.getenv("FLOWDROP_INTEGRATION")
    or not Path(".flowdrop/tools/turn-secret.json").exists(),
    reason="Disposable coturn not configured",
)


def attribute(kind, value):
    return struct.pack("!HH", kind, len(value)) + value + b"\0" * (-len(value) % 4)


def packet(attributes, key=None, kind=3):
    header = struct.pack(
        "!HHI", kind, len(attributes) + (24 if key else 0), 0x2112A442
    ) + secrets.token_bytes(12)
    if key:
        return (
            header
            + attributes
            + attribute(8, hmac.new(key, header + attributes, hashlib.sha1).digest())
        )
    return header + attributes


def receive(connection):
    def exact(length):
        data = b""
        while len(data) < length:
            block = connection.recv(length - len(data))
            if not block:
                raise RuntimeError("TURN closed connection")
            data += block
        return data

    header = exact(20)
    kind, length = struct.unpack("!HH", header[:4])
    body = exact(length)
    attributes = {}
    index = 0
    while index < length:
        code, size = struct.unpack("!HH", body[index : index + 4])
        attributes[code] = body[index + 4 : index + 4 + size]
        index += 4 + size + (-size % 4)
    return kind, attributes


def allocate(secret, expiry, incorrect=False, denied_peer=False):
    with socket.create_connection(("127.0.0.1", 53578), timeout=5) as connection:
        transport = attribute(0x19, b"\x11\0\0\0")
        connection.sendall(packet(transport))
        kind, challenge = receive(connection)
        assert kind == 0x113
        assert challenge[9][2] * 100 + challenge[9][3] == 401
        username = f"{expiry}:test-{secrets.token_hex(8)}"
        password = base64.b64encode(
            hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()
        ).decode()
        if incorrect:
            password = "incorrect"
        realm = challenge[0x14]
        key = hashlib.md5(
            username.encode() + b":" + realm + b":" + password.encode(),
            usedforsecurity=False,
        ).digest()
        attributes = (
            transport
            + attribute(6, username.encode())
            + attribute(0x14, realm)
            + attribute(0x15, challenge[0x15])
        )
        connection.sendall(packet(attributes, key))
        response = receive(connection)
        if denied_peer:
            assert response[0] == 0x103
            peer = (
                b"\0\1"
                + struct.pack("!H", 80 ^ 0x2112)
                + struct.pack("!I", 0x7F000001 ^ 0x2112A442)
            )
            auth = (
                attribute(6, username.encode())
                + attribute(0x14, realm)
                + attribute(0x15, challenge[0x15])
            )
            connection.sendall(packet(attribute(0x12, peer) + auth, key, kind=8))
            return receive(connection)
        return response


def test_real_coturn_authenticated_allocation_and_invalid_expired_credentials():
    secret = json.loads(Path(".flowdrop/tools/turn-secret.json").read_text())["secret"]
    kind, response = allocate(secret, int(time.time() + 600))
    assert kind == 0x103
    assert 0x16 in response  # XOR-RELAYED-ADDRESS proves an allocation was issued.
    for expired, incorrect in [
        (int(time.time() - 120), False),
        (int(time.time() + 600), True),
    ]:
        kind, response = allocate(secret, expired, incorrect)
        assert kind == 0x113
        assert response[9][2] * 100 + response[9][3] == 401
    kind, response = allocate(secret, int(time.time() + 600), denied_peer=True)
    assert kind == 0x118
    assert response[9][2] * 100 + response[9][3] == 403
