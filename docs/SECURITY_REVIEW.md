# Internal security review — v0.2.0

Reviewed 2026-10-13. This is an implementation review and automated regression evidence, not independent security certification.

## Confirmed improvements

- Authenticate encrypted upload requests before allocating per-share locks. Random unauthenticated IDs cannot grow that map.
- Bound request-rate identity storage without clearing existing limits when capacity is reached. Cloud requests allow 300 per minute per observed address; share creation additionally permits 10 per hour. These limits are process-local.
- Ignore forwarding headers by default. `FLOWDROP_TRUSTED_PROXIES` accepts explicit CIDRs; only a single syntactically valid address from a trusted direct peer is accepted. The edge must overwrite X-Forwarded-For. Nginx does this for the cloud route. Do not enable Uvicorn's unrestricted proxy trust; do not expose backend ports publicly.
- Recover LAN assembly failure to a retryable state, retaining chunks and removing the partial payload.
- Return a retryable 503 for cloud object writes/reads that fail; stage local ciphertext objects and replace atomically. Reject symlink roots and object reads.
- Bound cloud upload body time to 60 seconds and clean temporary bodies on interruption.
- Sender-only checkpoint API; a download capability cannot inspect upload progress.
- Download sessions use independent hashed random capabilities, expire within one hour, and check parent expiry/revocation on every chunk request. Limits count initiated sessions, not successfully saved files. Existing copies cannot be revoked.
- Send Later recovery checks original filename, size and SHA-256 before using the existing key/nonce pair. Keys and capabilities remain in sessionStorage in the originating browser tab; they are never sent as server metadata. This protects against accidental cross-file nonce reuse, not malicious scripts running in the same origin.

## Existing protections retained

Explicit device/recipient approval; scoped authorization; token hashing/expiry; same-origin mutations; WebSocket first-message authentication; chunk/body/storage limits; generated storage paths; SHA-256 verification; AES-GCM AAD binding; fragment-only decryption secrets; private S3 adapter; CSP and no-referrer; no payload logging; authenticated temporary TURN credentials.

## Open concerns

Local filesystem adversaries can race path checks; complete reparse-point/TOCTOU protection is unverified. LAN HTTP exposes capabilities to network observers, so use a trusted LAN or trusted TLS. SessionStorage is readable by same-origin scripts and persists in a cloned browser tab; do not use shared browser profiles for private sharing. Cloud locks and rate limits are process-local. Redis signaling/distributed abuse controls, production proxy/TLS verification, pinned container digests, PostgreSQL/S3 race tests, independent review and real TURN abuse verification remain release gates.
