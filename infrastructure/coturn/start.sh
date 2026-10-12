#!/bin/sh
set -eu
: "${TURN_SECRET:?Set TURN_SECRET}"
: "${TURN_REALM:?Set TURN_REALM}"
exec turnserver --no-cli --no-tls --no-dtls --fingerprint --use-auth-secret --static-auth-secret="$TURN_SECRET" --realm="$TURN_REALM" --listening-port=3478 --min-port=49160 --max-port=49200 --no-loopback-peers --no-multicast-peers --log-file=stdout
