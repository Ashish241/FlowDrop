# 0.3.1 LAN follow-up — LAN-20261015.2

The adapter/startup/packaging fixes are implemented. Current evidence and remaining acceptance gates are maintained in [LAN_CONNECTIVITY_VERIFICATION.md](LAN_CONNECTIVITY_VERIFICATION.md). This follow-up adds actual native Tk lifecycle/QR tests and local authenticated LAN payload/socket checks; physical phone, router isolation, clean-PC and human GUI acceptance remain unverified. No production readiness claim is made.

---

# Release readiness — 0.3.0 engineering checkpoint

Offline LAN follow-up (2026-10-15): explicit LAN startup, canonical pairing URL/QR and Windows socket verification are implemented; see [LAN_CONNECTIVITY_VERIFICATION.md](LAN_CONNECTIVITY_VERIFICATION.md). Current regression run: 32 backend, 9 unit and 14 browser tests passed; the six provider integration tests below belong to the previous checkpoint and were not rerun for this LAN-only fix. External physical/network acceptance gates remain open.

**Not a verified public release candidate. Not production ready.** Implementation and local automated verification advanced; mandatory external gates remain open.

| Area | IMPLEMENTED | AUTOMATED TESTED | PHYSICALLY VERIFIED | Release gate |
|---|---|---|---|---|
| Distributed signaling/session expiry/revocation/rates | Redis authority, optimistic room transactions, Pub/Sub, generation checks, bounded counters, capacity and fail-closed behavior | Two independent instances against real Redis; live socket revocation, worker restart and expiry | No separate-device deployment | HA/failover/load acceptance pending |
| Database/storage | Migrations, atomic quota/session transactions, private S3 adapter, cleanup and bounded failures | Native PostgreSQL 18 + Garage 2.4.1; browser encryption/decryption/recovery/revocation against them | No hosted deployment | Docker/production IAM/TLS/HA pending |
| TURN | Time-limited credentials, quotas/private-peer denial; current image digest | Coturn 4.18.0 real allocation/auth/expired-invalid refusal/loopback permission denial | No Internet relay | Actual browser relay/NAT/TLS acceptance pending |
| Transfer management | Capability-scoped persistent source queues, LAN round-robin, byte progress, rates/ETA, receiver reports and retry/backoff | LAN refresh/retry/privacy, WebRTC refresh/resend, encrypted refresh/backoff; 1 GiB HTTP loopback benchmark | No physical devices | Mobile/long streams and real network performance pending |
| Windows | Portable bundle and diagnostic graceful stop | Version/API/frontend/worker/start/zero-exit shutdown outside checkout | Same development Windows machine only | Native GUI and clean target PC pending |
| Infrastructure packaging | Supported manifests digest-pinned, private ports, health checks, disposable integration CI | Registry digests and Compose syntax | Containers not run | Docker engine absent; remote CI not run |

Current evidence: **21 baseline Pytest + 6 real-service integration tests, 9 Vitest, 13 Playwright passed**. The two cloud browser scenarios were also rerun against real PostgreSQL/Garage/Redis; those are repeat scenarios, not extra unique tests. Lint, strict build, dependency audits and Windows smoke passed. See TEST_REPORT.md and INFRASTRUCTURE_VERIFICATION.md.

## External blockers

- Separate PCs/phones, disconnected LAN/hotspot, firewall/mDNS, physical QR camera, real mobile browser saves and native GUI interaction.
- Clean Windows target without Python/Node/Git.
- Internet peers on different networks and actual authenticated browser TURN relay/fallback, long sessions and deployed TLS/proxy trust.
- Docker runtime/build execution and GitHub CI execution; local native service evidence does not substitute for container acceptance.
- Production storage/database/Redis HA, least-privilege credentials/lifecycle monitoring and independent security review.

## Remaining product limits

WebRTC restarts interrupted files rather than resuming arbitrary byte offsets. User queue reordering and cross-worker bandwidth fairness are not implemented. Send Later manages one share per tab and loses secret management capabilities when the tab closes. Browser site quota can prevent source persistence; explicit reselect recovery remains supported. Comprehensive filesystem race, long-worker/mobile and relay abuse acceptance remains open. See KNOWN_LIMITATIONS.md.

No public deployment, remote push, paid provisioning or release publication occurred. Physical acceptance instructions remain NOT VERIFIED in PHYSICAL_ACCEPTANCE.md. The previous source/ZIP checkpoint is preserved; see ROLLBACK.md.

---

## Historical v0.2.0 evidence (superseded by the current matrix above)

**Not production ready. The full project definition of done remains unmet.**

Updated 2026-10-13. v0.2.0 adds navigation-safe online panels, tab-scoped online history, explicit room reconnect, encrypted upload refresh/retry management, optional download-session limits, retryable storage failures, bounded abuse controls and explicit proxy trust. See TEST_REPORT.md, SECURITY_REVIEW.md, KNOWN_LIMITATIONS.md and PHYSICAL_ACCEPTANCE.md for current evidence and limits. The original completed checks below are v0.1.0 baseline evidence; current counts/results are maintained in TEST_REPORT.md.

| Gate | Status |
|---|---|
| LAN, WebRTC, encrypted links, optical text | IMPLEMENTED; automated loopback tests |
| Navigation/reconnect, encrypted upload resume and limits | IMPLEMENTED; AUTOMATED TESTED |
| Unified history | IMPLEMENTED partially; online speed/ETA, participant labels and full controls remain incomplete |
| Storage failures, proxy trust and bounded rate controls | IMPLEMENTED; AUTOMATED TESTED |
| PostgreSQL/S3/TURN/TLS/container integration | BLOCKED by unavailable engine/test infrastructure; NOT VERIFIED |
| Redis signaling | Not implemented; single-process room state only |
| Physical acceptance / clean Windows / native GUI | NOT VERIFIED; checklist supplied |
| Release | NOT RELEASE READY |

## Completed checks

- [x] Functional React/TypeScript application and production bundle.
- [x] Approved LAN device pairing, authenticated APIs/WebSockets and text sharing.
- [x] Receiver-approved binary/Unicode/empty uploads, streamed assembly and native downloads.
- [x] Duplicate/out-of-order chunks, pause/resume, restart recovery and chunk-size negotiation.
- [x] Three-context broadcast and host-mediated private client-to-client sharing.
- [x] Actual loopback WebRTC, bounded acknowledgement flow, streamed and zero-byte downloads.
- [x] Browser AES-GCM, encrypted metadata, completeness/order checks and encrypted link download/revocation.
- [x] Optical frame protocol and actual QR raster decoding; camera UI implemented.
- [x] Automated accessibility in light/dark themes and five layout widths.
- [x] 16 Pytest, 7 Vitest and 11 Playwright tests passed at the latest checkpoint.
- [x] Python and JavaScript lint, strict TypeScript and production build.
- [x] Python audit: 47 scoped installed dependencies, no known vulnerabilities after urllib3 upgrade.
- [x] npm installation audit: 261 packages, no reported vulnerabilities.
- [x] Initial Alembic migration applied to disposable SQLite database.
- [x] Docker Compose syntax validated with disposable validation settings.
- [x] Windows portable executable/ZIP rebuilt, and API/frontend/worker smoke-tested outside source checkout.

## External acceptance blockers

- [ ] Separate physical PCs/phones; disconnected LAN/hotspot; firewall and mDNS checks.
- [ ] Interactive native control-panel use and a clean Windows target with no Python/Node/Git.
- [ ] Physical camera scanning, exposure/motion behavior, real mobile download behavior.
- [ ] Real Internet direct-P2P and authenticated TURN relay tests, including long sessions.
- [ ] Running PostgreSQL/MinIO/coturn containers. Docker Desktop engine could not start/confirm here.
- [ ] Real PostgreSQL/S3 concurrency, lifecycle/IAM and failure tests.
- [ ] Trusted TLS/reverse-proxy deployment, domain and credentials; external publication approval.
- [ ] Actual large-file/network benchmarks and independent security review.

## Remaining implementation work

- Finish dashboard participant labels/speed/ETA and full online controls; persisted fair queue scheduling and byte-level WebRTC recovery.
- Durable multi-share sender management beyond one browser tab; automatic reconnect and longer/mobile sessions.
- Distributed abuse controls, Redis signaling and production image digest pinning.
- Further queue ordering/fairness and comprehensive disk-full/network-loss regression coverage.
- Complete filesystem-race tests, long-running streaming worker/mobile compatibility and receiver disk outcome reporting.
- Further stack consolidation: current UI uses React state and local CSS rather than every preferred styling/state/router library. No artificial shared packages were added.

The ZIP is suitable for local development review and testing, not public release. No cloud resources were provisioned, and no Git push/publication occurred.
