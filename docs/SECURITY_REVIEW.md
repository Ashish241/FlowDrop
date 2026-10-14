# 0.3.1 desktop network review

LAN remains explicit opt-in. Physical adapter discovery uses Windows hardware, route and profile information; automatic selection cannot fall back to WSL/virtual interfaces. Multiple physical candidates require explicit choice. Public/unknown networks require explicit trusted-interface confirmation in the GUI; CLI automatic Public selection is refused. No profile is changed. Restart revalidates adapter identity/IP and gives current port/URL information.

The host capability is used only in the loopback dashboard fragment and authenticated readiness requests. Pairing QR contains the selected LAN URL and short-lived code, never the host capability. This PC Only produces no phone QR. HTTP/WS same-origin rules and exact Host validation apply to both sockets. Native diagnostics bypass environment HTTP proxies to reach the actual local service, validate host authentication and never infer phone reachability from local requests.

Optional firewall setup requires explicit panel approval plus UAC. Rules are deterministic and scoped to the exact executable, selected IP, TCP port, Private profile and LocalSubnet. Existing conflicting/disabled named rules are rejected; other rules and profiles remain untouched. Real firewall mutation/UAC interaction was not executed during verification. Rule construction and escaping were regression-tested and policy was read from Windows.

---

# Internal security review — v0.3.0

Internal implementation review only; no independent certification.

2026-10-15 LAN fix: network exposure requires explicit desktop checkbox / CLI `--lan` or private `--bind`. Default remains loopback. Desktop requests allow only bound local addresses and the exact generated mDNS name; implicit forwarded-header trust is disabled. Pairing and host approval, per-transfer acceptance and same-origin HTTP/WS checks are retained. No wildcard CORS or firewall/profile changes were introduced. Native socket tests confirm unauthorized transfer/socket access is denied.

Current additions:

- Redis is the configured authority for room membership/approval/expiry and socket generations. Optimistic updates reject concurrent extra receivers; revocation denies future ICE and closes live sockets across instances. Configured Redis outages fail closed. Global room capacity and expiring distributed rate counters bound state growth; backend WS/concurrency limits are explicit.
- Async uploads stage bounded request bodies before opening locked transactions; database locks and S3 operations run together in bounded workers, preserving event-loop responsiveness and admission slots through request cancellation. Duplicate concurrent uploads are idempotent and covered against PostgreSQL.
- Signaling waits for the Redis subscription acknowledgement and connected receiver before readiness notices; frontend approval checks reject obsolete asynchronous offers, and explicit cancellation clears pending sinks/waiters.
- PostgreSQL download session issuance now locks before reading counters, avoiding stale identity-map state in concurrent transactions. Actual simultaneous quota and download-limit tests passed.
- S3 writes can raise boto3's wrapped upload exception; it is now caught and returns a generic retryable 503. Missing-object read, unavailable bucket write, unchanged checkpoints and successful retry are real-service tested. Upload bodies, concurrency, share count, storage quota and SDK network retries/timeouts are bounded. Control/create/chunk rates are separate and distributed when Redis is configured.
- Proxies overwrite forwarding headers; Uvicorn implicit proxy trust is disabled in backend containers. Public origins and immediate trusted peers must be explicitly configured. Trusted TLS/proxy deployment still needs external acceptance.
- Browser requests are aborted/scoped on LAN session changes; history and pending source recovery are scoped to the capability/session. Hash checks prevent changed-file recovery. Plaintext source Files intentionally persist locally for recovery and are not protected from local-profile or same-origin-script adversaries; see PRIVACY.md.
- Current coturn 4.18.0 is pinned, validates secrets, limits allocations/bandwidth and denies private/link-local/multicast peers. Valid/invalid/expired allocation credentials and loopback permission denial were tested locally. Internet relay, IPv6 deployment ACLs and TLS acceptance remain open.
- Supported image digests were independently checked against downloaded registry manifests. This is integrity pinning, not a native/container vulnerability audit. Python/npm audits report no known findings at this checkpoint.

Open gates: filesystem/reparse-point race coverage, worker/storage/network fault saturation, long/mobile streams, Redis/storage HA/failover, deployed proxy/TLS/relay abuse and independent review. LAN HTTP remains appropriate only for trusted networks or trusted-certificate TLS. Review physical acceptance and known limitations before public release.

---

## Historical v0.2.0 review

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
