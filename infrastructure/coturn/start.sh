#!/bin/sh
set -eu
: "${TURN_SECRET:?Set TURN_SECRET}"
: "${TURN_REALM:?Set TURN_REALM}"
case "$TURN_SECRET" in *[!A-Za-z0-9_-]*|'') echo 'TURN_SECRET must be a random URL-safe token' >&2; exit 1;; esac
[ "${#TURN_SECRET}" -ge 32 ] || { echo 'TURN_SECRET must contain at least 32 characters' >&2; exit 1; }
case "$TURN_REALM" in *[!A-Za-z0-9.-]*|'') echo 'Invalid TURN_REALM' >&2; exit 1;; esac
umask 077
config=$(mktemp /tmp/flowdrop-turn.XXXXXX)
printf 'use-auth-secret\nstatic-auth-secret=%s\nrealm=%s\nfingerprint\nlistening-port=3478\nmin-port=49160\nmax-port=49200\nno-multicast-peers\nuser-quota=2\ntotal-quota=128\nmax-bps=10485760\ndenied-peer-ip=0.0.0.0-0.255.255.255\ndenied-peer-ip=127.0.0.0-127.255.255.255\ndenied-peer-ip=10.0.0.0-10.255.255.255\ndenied-peer-ip=169.254.0.0-169.254.255.255\ndenied-peer-ip=172.16.0.0-172.31.255.255\ndenied-peer-ip=192.168.0.0-192.168.255.255\ndenied-peer-ip=::1\ndenied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff\ndenied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff\n' "$TURN_SECRET" "$TURN_REALM" > "$config"
exec turnserver -c "$config" --cli=false --no-tls --dtls=false --log-file=stdout --pidfile=/tmp/flowdrop-turn.pid
