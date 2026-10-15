# 0.3.2 optional public HTTPS deployment

See [ONLINE_SHARING_GUIDE.md](ONLINE_SHARING_GUIDE.md) for the concrete `compose.yaml` + `compose.online.yaml` HTTPS/WSS edge, owned DNS, TURN public addressing/TLS/relay ports, strict proxy hop trust and desktop configuration. The overlay parses and its Caddy manifest digest is recorded in ONLINE_CONTAINER_PIN.json; Docker runtime, public deployment and Internet acceptance are NOT RUN. Deployment/provisioning still requires explicit authorization. Never expose the desktop LAN server as the public online backend.

---

# Deployment

No hosted resources have been provisioned, and nothing has been pushed or published. Deployment configuration is provided for review; this is not a production-ready release.

## Local container stack

Copy `.env.example` to `.env` and set independent PostgreSQL/Redis passwords, Garage RPC secret and bucket credentials. `docker compose up --build` serves localhost:8080 with PostgreSQL, Redis and private Garage S3-compatible development storage. Migration 0002 runs before the cloud service starts; web startup waits for backend health. Database, Redis and storage ports are not published. This single-node storage configuration is for development; no data redundancy is claimed. The MinIO configuration remains only under an unsupported `legacy-minio` profile; no prior object volumes are migrated or removed.

`docker compose --profile turn up --build` also exposes TURN ports. This materially changes network exposure: review firewall and NAT settings before using it. Never use example or placeholder credentials. Do not run this profile on an untrusted host without reviewing access protections.

Both Compose files were syntax validated. Supported images are digest-pinned with public manifest evidence in CONTAINER_PINS.json. The engine remains unavailable here, so container builds/runs and CI are unverified. Actual native PostgreSQL/WSL Redis/Garage/coturn checks are documented in INFRASTRUCTURE_VERIFICATION.md; they do not prove the container deployment.

## Hosted deployment

Serve the frontend with HTTPS. Proxy `/signal/` to the signaling service and `/cloud/` to the encrypted storage service using the provided nginx configuration. Preserve WebSocket Upgrade headers and allow long-running WebSocket connections. Set FLOWDROP_ORIGINS to the exact public frontend origins. Set FLOWDROP_STUN_URL, FLOWDROP_TURN_URL and FLOWDROP_TURN_SECRET to your reviewed connectivity services.

The example Caddyfile provides a TLS terminator; it is not yet integrated into a tested production Compose profile. Configure trusted proxy addresses explicitly and preserve the external scheme/host so origin checks work behind TLS. Do not blindly trust arbitrary forwarded headers. Do not bypass browser certificate validation.

Set REDIS_URL for multi-instance signaling and distributed rates. Configured outages fail closed. Room updates use optimistic transactions; Pub/Sub routes messages to generation-checked sockets. Memory mode is single-instance development only. PostgreSQL quota/session issuance races were verified locally; global row coordination complements bounded per-process upload admission. Redis HA/failover, scale and production abuse acceptance are still required.

S3 requires private storage and narrowly scoped credentials for object read/write/delete and prefix listing for cleanup. Apply Alembic migrations through 0002 before cloud startup. Actual Garage signed reads/writes, private access, expired-prefix/orphan cleanup and storage failure retry were tested. Production IAM, retention monitoring, replicated deletion guarantees and provider-specific behavior still need acceptance. Cloud upload concurrency, share capacity and SDK timeouts/retries are bounded.

Set FLOWDROP_PUBLIC_ORIGIN to the exact external TLS frontend origin and FLOWDROP_TRUSTED_PROXIES to the actual immediate trusted proxy IPs/CIDRs. The provided proxy overwrites X-Forwarded-For and backend commands disable Uvicorn implicit proxy-header trust. Keep the origins/proxy settings consistent with the deployment; do not enable broad trust for internet peers.

Use `--tls-cert` and `--tls-key` on the desktop launcher with a certificate trusted by the connecting devices for untrusted local networks. Certificate distribution, hostname matching, and actual TLS device testing remain operator requirements.

Costs depend on compute, TURN bandwidth, database, object storage, and egress. No costs have been incurred by provisioning cloud resources. External provisioning, publication and credentials require user approval.
