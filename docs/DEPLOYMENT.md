# Deployment

No hosted resources have been provisioned, and nothing has been pushed or published. Deployment configuration is provided for review; this is not a production-ready release.

## Local container stack

Copy `.env.example` to `.env` and set strong independently generated PostgreSQL, S3 and TURN secrets. `docker compose up --build` serves the web application at localhost:8080 and creates local PostgreSQL and private MinIO storage. The database migration runs before the cloud service starts. Bucket initialization explicitly disables anonymous access. Database and object storage ports are not published.

`docker compose --profile turn up --build` also exposes TURN ports. This materially changes network exposure: review firewall and NAT settings before using it. Never use example or placeholder credentials. Do not run this profile on an untrusted host without reviewing access protections.

Compose syntax was validated. Docker engine startup/integration is pending. Images use floating upstream tags in development configuration; pin audited image digests before any production release.

## Hosted deployment

Serve the frontend with HTTPS. Proxy `/signal/` to the signaling service and `/cloud/` to the encrypted storage service using the provided nginx configuration. Preserve WebSocket Upgrade headers and allow long-running WebSocket connections. Set FLOWDROP_ORIGINS to the exact public frontend origins. Set FLOWDROP_STUN_URL, FLOWDROP_TURN_URL and FLOWDROP_TURN_SECRET to your reviewed connectivity services.

The example Caddyfile provides a TLS terminator; it is not yet integrated into a tested production Compose profile. Configure trusted proxy addresses explicitly and preserve the external scheme/host so origin checks work behind TLS. Do not blindly trust arbitrary forwarded headers. Do not bypass browser certificate validation.

Run signaling with one worker: room membership is in memory. Redis-backed multi-instance signaling is not implemented. Storage quota and upload coordination currently rely partly on application process state; distributed cloud abuse controls require hardening before public exposure. PostgreSQL row/transaction isolation and multi-instance race tests remain pending.

S3 requires a private bucket and narrowly scoped service credentials (object read/write/delete for the FlowDrop namespace). Development Compose uses MinIO administrative credentials and must not be copied directly to production. Apply initial Alembic migration 0001 before starting cloud service. Retention cleanup runs every minute and must be monitored; storage failure retry and orphan reconciliation are not complete.

Use `--tls-cert` and `--tls-key` on the desktop launcher with a certificate trusted by the connecting devices for untrusted local networks. Certificate distribution, hostname matching, and actual TLS device testing remain operator requirements.

Costs depend on compute, TURN bandwidth, database, object storage, and egress. No costs have been incurred by provisioning cloud resources. External provisioning, publication and credentials require user approval.
