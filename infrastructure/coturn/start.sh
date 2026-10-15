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
# A NAT/container deployment must advertise the operator's actual relay mapping.
if [ -n "${TURN_EXTERNAL_IP:-}" ]; then
    case "$TURN_EXTERNAL_IP" in *[!0-9./]*|'') echo 'TURN_EXTERNAL_IP must be an IPv4 or public/private IPv4 mapping' >&2; exit 1;; esac
    printf 'external-ip=%s\n' "$TURN_EXTERNAL_IP" >> "$config"
fi
if [ -n "${TURN_TLS_CERT:-}" ] || [ -n "${TURN_TLS_KEY:-}" ]; then
    : "${TURN_TLS_CERT:?Set TURN_TLS_CERT and TURN_TLS_KEY together}"
    : "${TURN_TLS_KEY:?Set TURN_TLS_CERT and TURN_TLS_KEY together}"
    case "$TURN_TLS_CERT$TURN_TLS_KEY" in *[!A-Za-z0-9_./-]*) echo 'Use safe absolute certificate paths' >&2; exit 1;; esac
    [ -r "$TURN_TLS_CERT" ] && [ -r "$TURN_TLS_KEY" ] || { echo 'TURN TLS certificate/key not readable' >&2; exit 1; }
    printf 'tls-listening-port=5349\ncert=%s\npkey=%s\n' "$TURN_TLS_CERT" "$TURN_TLS_KEY" >> "$config"
    set -- --dtls=false
else
    set -- --no-tls --dtls=false
fi
exec turnserver -c "$config" --cli=false "$@" --log-file=stdout --pidfile=/tmp/flowdrop-turn.pid
