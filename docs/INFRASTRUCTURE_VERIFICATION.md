# Infrastructure evidence — v0.3.0

Verified locally on Windows 11 with disposable services on 2026-10-13. Docker's Linux engine pipe is missing. An explicit WSL executable invocation worked; no installed Windows PostgreSQL service or system package installation was changed.

| Component | Executed evidence | Limits |
|---|---|---|
| Redis 8.0.5 | Real TCP client; two independent ASGI app instances: approval, SDP routing, atomic join, shared rate counters, worker restart, actual Redis key expiration and revocation | Pub/Sub is transient; reconnect/renegotiate after lost signaling. Redis HA/failover not verified. |
| PostgreSQL 18 | Separate cluster on 127.0.0.1:55432; migrations 0001→0002; concurrent quota reservations and download-limit transactions | Container image uses PostgreSQL 17 and has not run here. Native 18 evidence is distinct. |
| Garage 2.4.1 S3 | Private signed upload/download, unauthorized access 403, orphan-prefix expiry cleanup, missing object failure, nonexistent-bucket write failure and successful retry | Single-node test instance, no redundancy; no production IAM/lifecycle/HA claim. |
| Coturn 4.18.0 | Built current upstream source; real TCP TURN Allocate challenge/authentication, valid allocation, incorrect/expired password refusal, denied loopback peer permission | No Internet/NAT/UDP relay throughput or browser relay fallback claim. TLS listener deployment not tested. |
| Containers | Seven public image manifests resolved and SHA-256 checked; both Compose configurations validated | Docker image builds/runs and GitHub CI execution remain blocked/not run. Digests are not vulnerability certification. |

The old MinIO community download endpoint returned HTTP 410 and its public registry manifest returned 401 during this run. Development Compose now uses Garage; the old MinIO profile remains `legacy-minio`, unsupported and disabled by default. No existing MinIO data was migrated or removed.

## Automated reproduction

`python -m scripts.integration_check` requires a disposable loopback PostgreSQL database whose name ends with `_integration`, a Redis URL, and optional S3 fixture credentials. The native setup used `.flowdrop/integration-pg` and `.flowdrop/pg-test-password`, keeping the installed PostgreSQL service untouched. The runner never prints credentials.

The disposable Compose harness is `compose.integration.yaml`. On a machine with Docker:

1. Create `.flowdrop/tools`, run `python -m scripts.prepare_test_s3` and `python -m scripts.prepare_test_turn` with `FLOWDROP_TEST_TURN_BIND=0.0.0.0` for the container listener.
2. Run `python -m scripts.prepare_ci_integration` to generate test-only passwords and an ignored environment file.
3. Run `docker compose --env-file .flowdrop/integration.env -f compose.integration.yaml -p flowdrop-ci up -d --wait --wait-timeout 120`.
4. Run `python -m scripts.integration_check`.
5. Stop only that disposable project with `docker compose --env-file .flowdrop/integration.env -f compose.integration.yaml -p flowdrop-ci down --volumes`.

The CI integration job performs these steps on its disposable runner. It is configured, not remotely executed here. Native Windows/WSL tests executed without Docker and are reported separately.

## Deployment controls

`REDIS_URL` selects distributed signaling/rate controls. Configured Redis failures fail closed; the application does not silently switch to isolated room state. Redis stores capability hashes, room approval/connection metadata and expiring rate counters, never file bytes or decryption keys. Memory mode remains available for standalone development; do not run it across multiple workers.

Set `FLOWDROP_ORIGINS` to exact browser origins, `FLOWDROP_PUBLIC_ORIGIN` to the cloud frontend's exact TLS origin, and `FLOWDROP_TRUSTED_PROXIES` only to the actual immediate trusted proxy addresses/CIDRs. Nginx overwrites X-Forwarded-For; backend containers disable Uvicorn's implicit forwarded-header trust. With no trusted proxies configured, limits conservatively aggregate at the direct peer address.

Use URL-safe generated Redis/PostgreSQL passwords (or correctly percent-encode URL components), a `GK` plus 32-hex-character Garage access key, separate random S3 secret, 64-hex-character Garage RPC secret and at least 32 URL-safe TURN secret characters. Environment examples contain no real credentials. Keep backend/Redis/database/S3 ports private. Default Compose publishes the frontend only on loopback; the optional TURN profile requires an explicit secret and exposes its listed relay ports when deliberately enabled.

TURN now has allocation/bandwidth quotas and denies loopback, private/link-local and multicast peers. Validate IPv4/IPv6 ACLs, external address mapping, firewall rules and actual authenticated browser relay in the deployment acceptance environment before release.

Implementation references: [Redis transactions](https://redis.io/docs/latest/develop/clients/redis-py/transpipe/), [Redis Pub/Sub](https://redis.io/docs/latest/develop/use-cases/pub-sub/redis-py/), [Garage setup](https://garagehq.deuxfleurs.fr/documentation/quick-start/), [Garage secret configuration](https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/), [coturn release](https://github.com/coturn/coturn/releases/tag/4.18.0), [Docker registry manifest API](https://docs.docker.com/reference/api/registry/latest/operations/GetImageManifest/).
