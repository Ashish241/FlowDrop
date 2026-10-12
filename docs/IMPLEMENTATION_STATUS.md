# Implementation status

Updated: 2026-10-12. Development version: 0.1.0.

## Phase 1 — TESTED

Requirements: monorepo, React/TypeScript frontend, Python backend, design system, tests, CI.

Implemented: React/TypeScript frontend, responsive design, light/dark control, Python manifests, Pytest/Vitest/Playwright, Ruff, CI pipeline, JSON offer contract, build scripts. Existing repository was empty except Git metadata. Frontend lint configuration is being finalized.

Files: apps/web, services/lan_server, tests/test_lan.py, pyproject.toml, README.md.

Executed: strict TypeScript/Vite, Ruff and ESLint passed; Vitest 7, Pytest 16 and Playwright 11 tests passed. Real browser checks cover native saved bytes, 3-client privacy/broadcast, streamed/empty WebRTC, encrypted links, 360/390/768/1024/1440px and both WCAG themes. CI itself has not run on GitHub.

Remaining: further manual accessibility/device audit and actual CI execution after authorized publication.

## Phase 2 — IN PROGRESS

Implemented: scoped host/device capabilities, pairing/renewal/approval, recipient approval, device revocation, chunk upload/assembly, integrity verification, native streamed downloads with scoped HttpOnly cookies, cancellation/deletion, text sharing, QR pairing. Tested with real Chromium contexts and saved-byte comparisons.

Tested: pairing approval/revocation; binary and empty transfer; duplicate chunks; reject preapproval upload; reject unauthenticated download; corrupted payload rejection; cross-origin mutation rejection; authenticated text sharing.

Security concerns: HTTP LAN is unencrypted; optional trusted-certificate TLS is implemented but not device tested. Host storage is trusted, plaintext local storage. Native browser downloads rely on server-side integrity verification. Symlink checks are implemented but malicious filesystem race tests remain pending.

Remaining: real physical LAN/hotspot testing, mobile browser checks, network interruption beyond in-process tests, stronger request and WebSocket abuse testing.

## Phase 3 — IN PROGRESS

Implemented: hashed persistent capabilities, atomic metadata, restart resume/reselection, negotiated 1/2/4 MiB chunks across config changes, lean checkpoints, pause/resume, multiple recipients, bounded configurable server concurrency, disk reservation, timeouts/daily cleanup, mDNS/adapters/ports and native controls. Fresh portable executable/ZIP built; help/API/frontend/worker passed outside source checkout. Interactive GUI and clean-PC verification pending.

Tests: restart recovery/privacy and pause/out-of-order/cancellation passed. A synthetic 32 MiB ASGI upload+verification completed in 0.6567s with observed RSS growth 0.27 MiB; four concurrent 4 MiB files completed in 0.2459s with observed growth 1.45 MiB. See BENCHMARK_RESULTS.json; these are NOT network throughput measurements.

Remaining: physical multi-device checks, mDNS discovery verification, GUI interaction tests, clean target-PC offline executable verification, queue persistence/reordering and measured fairness.

## Phase 4 — IN PROGRESS

Implemented: independent room server, scoped WebSockets/ICE, owner approval, SDP/ICE, optional STUN/coturn HMAC credentials, actual DataChannels, receiver approval and SHA-256. Secure browsers now stream with a 1 MiB ACK window and bounded 2 MiB receive queue. Unsupported browsers have a 128 MiB fallback. Real 2 MiB+17 byte and zero-byte saved downloads passed. Runtime configured ceiling is 20 GiB, not a verified physical transfer size.

Remaining: Internet NAT/TURN, long/large physical transfers, navigation/session persistence and online queue orchestration. Signaling remains single-worker; Redis distribution is not implemented.

## Phase 5 — IN PROGRESS

Implemented: AES-GCM browser chunk encryption, non-reused index nonces, AAD binding share/index/count, encrypted metadata/completeness checks, secret fragment links, scoped upload/download tokens, private S3 adapter, SQLAlchemy metadata, SQLite/local test adapter, expiry/revocation/cleanup, quota limits, Alembic initial migration. Unit tampering/order/count tests and real encrypted browser download/revoke passed.

Implemented since previous checkpoint: atomic quota reservations (SQLite immediate transactions / PostgreSQL advisory transaction lock), parent row locking, expired-share prefix cleanup including orphan objects, retrying cleanup and the shared streamed decrypt/save sink. Concurrent SQLite quota/orphan tests passed. Actual PostgreSQL/S3 coordination remains unverified. Sender persistence, cancel/retry and optional limits remain incomplete. Docker integration is BLOCKED by engine startup.

## Phase 6 — IN PROGRESS

Implemented: raw-text copy/resend/manual fallback, 100-message history cap, multi-device UI, progress/estimates, flat folder selection and experimental QR text/camera UI. Protocol and actual QR raster decoder tests passed; physical camera pending. Contrast fixed, real dark palette preserves QR colors; both themes pass automated WCAG checks. No continuous clipboard surveillance.

Remaining: physical optical scan; better transfer analytics, unified transport UI, accessibility audit and exact receiver download status reporting.

## Phase 7 — IN PROGRESS

Implemented: docs/MIT/CI/infrastructure/migration, fresh Windows ZIP and executable smoke, security bounds/CSP, benchmark and dependency scans. Three urllib3 findings were fixed with 2.8.0; final Python audit reports no known vulnerabilities. npm installation audit reports zero. See RELEASE_READINESS.md.

Remaining: independent security review, physical/clean-PC/GUI acceptance, real network benchmarks, deployed database/storage/TURN/TLS verification and release signoff. Remaining implementation work is listed explicitly in RELEASE_READINESS.md.

External blockers: real phones and isolated LAN testing; TURN deployment and relay network tests; cloud deployment credentials and explicit publication approval. No external resources have been created and no repository push has occurred.

Next milestone: finish independent lint/regression/packaging/security checks and document external acceptance blockers. No repository push or publication is authorized without final approval.

## Release readiness

**Not ready.** Full definition of done is not satisfied. Existing tests verify real browser workflows on loopback and simulated service/storage integration, not physical devices, Internet connectivity, TURN, real S3/PostgreSQL or a clean Windows target.
