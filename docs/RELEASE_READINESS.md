> **Focused UI polish, 2026-10-18:** Navbar divider removed; accessible invitation modal, compact chat and staged Optical Send/Receive UI implemented. Final local results: 23 Online browser, eight desktop/LAN browser, 31 unit and 87 backend tests passed (seven infrastructure skips); lint, TypeScript and production builds passed. This polish is not deployed: the existing public close-frame gate remains failed. See [UI polish report](UI_POLISH_VERIFICATION.md) and [results](UI_POLISH_VERIFICATION.json).

> **2026-10-18 update — release verification blocked:** Render Free manually deployed backend `4257560` (`dep-dba8nlgm7kps73ftjaog`), but Python and Chromium still observe abnormal WebSocket close 1006 after the removal event. Mandatory actual 4003 close-frame verification failed. The corrected frontend is withheld; public Pages remains `8076ed5` (`35f51697-1f2d-409f-86e7-10f3ff1010ba`). Local gates passed (87 backend, 31 units, 22 Online browser, 8 desktop browser), but no final public acceptance is claimed. Automatic deployment is off; Windows binaries are preserved. See [current release evidence](MASTER_PRODUCT_RELEASE.md) and [machine-readable results](MASTER_PRODUCT_VERIFICATION.json).

Final optical source ccc356c is manually deployed on existing Pages Free (deployment ec70164f-7da3-4e45-85b8-b16d90791fc5). Public HTTPS/WSS security checks passed. Frontend units: 31 passed. Final clean hosted browser suite: 17 passed, 1 local-clock-only skip; public optical tests: 7 passed. Exact results and intermediate failures are recorded in OPTICAL_VERIFICATION.json; physical camera verification remains outstanding. Automatic deployments remain paused; existing backend and Windows artifacts are preserved.

# Optical reliability repair — 2026-10-17

Source `7bb2c1f` implements compact v3 optical frames, bounded Reed–Solomon erasure recovery, selective recovery QR/manual requests, worker decoding, image-load-based playback and diagnostics. The exact 64 KiB fixture reconstructs with matching SHA-256 after loss/recovery in actual QR-image tests with browser networking disabled. Baseline 328 frames becomes 164 data + 42 parity = 206 at the conservative default; this alone is not a speed or physical-reliability claim. Local units 31, backend 84 (7 provider skips), desktop 8 and combined 20 (1 TURN skip) passed. Online full run 16 passed, additional timing/FEC tests and final optical subset 7 passed; Vite rooms 3 and builds/lint passed. Deployment/public results and detailed measured capacity, decoder limits and physical acceptance gates are in [optical report](OPTICAL_RELIABILITY.md) and [evidence](OPTICAL_VERIFICATION.json). Windows binaries preserved. Earlier records below are historical.

---

# Transfer UX addendum — 2026-10-17

Verified source `fade6cf` adds per-attachment recipient status, retained files through partial success, explicit retries excluding verified devices, automatic clearing after every intended recipient verifies, and new-device auto-selection that preserves local manual choices. Local Online 13, desktop 8, Vite rooms 3, frontend units 19, backend 84 passed (7 provider skips); preserved combined 20 passed (1 TURN skip). Lint, TypeScript, builds, axe and code-rotation regressions passed. Windows ZIP unchanged. Manually deployed on Pages Free (`f902f348-6a52-4a65-86ed-9837402ea3f9`); public HTTPS/WSS checks and the complete public suite (12 passed, 1 local-clock-only skip) passed. Exact results are in [addendum report](TRANSFER_UX_ADDENDUM.md) and [evidence](DELIVERY_VERIFICATION.json). Existing free backend unchanged. Physical cross-network/camera/TURN remain unverified; server restarts still erase rooms. Earlier entries below are historical.

---

# Online workspace release — 2026-10-16

Verified workspace checkpoint `236535d` implements the fluid Online workspace, additive attachment composer, retained in-page selections, automatic invitation rotation, active-room heartbeat and validated QR joining. Local backend 84 passed/7 provider skips; frontend units 17; production Online 11; desktop 8; Vite rooms 3; combined 20 passed/1 TURN skip. Lint/TypeScript/builds and home/workspace axe checks passed. The Windows ZIP hash is unchanged. Both existing Free projects are manually deployed from `236535d`; public HTTPS/WSS checks and the complete hosted browser suite (10 passed, 1 local-clock-only skip) passed. Actual bytes were checked between same-PC peers. Deployment details are in [workspace report](WORKSPACE_REDESIGN.md) and [evidence](WORKSPACE_VERIFICATION.json). Existing free single-instance rooms do not survive provider restarts; physical cross-network and TURN remain unverified. Earlier entries below are historical.

---

# Named multi-device rooms — 2026-10-16

Live website https://flowdrop-online.pages.dev now uses named rooms with automatic entry, live rename, addressed multi-peer WebRTC, selected recipients, individual file/batch acceptance, independent progress and creator locking. Frontend `06d2c48` and backend `5859e74` are manually deployed on the existing free projects. Final guarded public room suite: **5 passed**; public v2 security/WSS and legacy v1 compatibility passed. Local Python 82 passed/7 provider skips, frontend unit 14, production rooms 5, Vite rooms 3 and desktop browser 8 passed; lint/TypeScript/builds passed. Legacy combined suite had 19 passes/1 timeout/1 TURN skip; the timeout passed alone, and both legacy WebRTC cases passed again after the completion safeguard. ZIP unchanged. Physical cross-network and TURN remain unverified. [Architecture, exact deployment IDs, results and limits](NAMED_ROOMS.md); [machine-readable evidence](ROOMS_VERIFICATION.json). Earlier entries below are historical.

---

# Post-connection normal-screen fix — 2026-10-16

Live frontend source `1505894` deployed successfully to https://flowdrop-online.pages.dev (Pages `ad70e9bf-65ba-4caa-9416-62f77b49c08f`), existing Render backend unchanged. Both paired roles now retain normal file/text actions and explicit sending. Local online 9, development scenario 1, desktop 8, frontend units 14 and backend 78 passed (7 provider skips); lint, TypeScript and builds passed. Public service verification passed; eight existing public scenarios passed together and the new bidirectional normal-screen scenario passed separately after rate-window recovery. Earlier public attempts encountered local DNS/network failures and a confirmed ICE HTTP 429; no clean nine-test public run is claimed. Exact saved bytes verified both directions in isolated same-PC contexts. Windows ZIP preserved; physical cross-network and TURN remain unverified. [Root cause, changed behavior and complete evidence](POST_CONNECTION_FIX.md). Earlier entries below are historical.

---

# Online 0.4.1 live fix — 2026-10-16

Deployed: https://flowdrop-online.pages.dev (source `ba587a6`), with existing Render signaling. Fixed discarded preconnection file selection, idle cancellation state, bounded download fallback and shared ICE/pairing/revocation request budget; simplified Online-only UI. Actual public browser suite: 8 passed, with saved-byte checks on same-PC peers; no physical cross-network claim. Backend 78 passed (7 provider skips), frontend unit 14, local online 8, desktop 8, preserved combined 20 (1 TURN skip). Lint/TypeScript/build passed. Both providers use manual free deployment; Windows ZIP unchanged. [Complete root cause, deployment IDs, verification and external gates](ONLINE_0.4.1_VERIFICATION.md). Earlier records below are historical.

---

# Public deployment completed — 2026-10-16

Website: https://flowdrop-online.pages.dev. Signaling: https://flowdrop-signaling.onrender.com/signal. Deployed with explicit authorization on Pages Direct Upload and Render Free; Git auto-deployment off. Public HTTP/WSS/security/room checks passed, as did deployed-site text and a saved hash-matched 64 KiB WebRTC file between two tabs on the same PC. Physical cross-network transfers and TURN remain unverified. Windows ZIP unchanged. See [actual deployment evidence and limitations](PUBLIC_DEPLOYMENT_STATUS.md). The preparation record below is historical.

---

# Public deployment preparation — 2026-10-16

Guarded Pages builds and a deployment HTTP/WSS verifier are implemented. Latest local checks: 77 backend passed (7 provider skips), 13 frontend unit passed, 5 online and 8 desktop product browser tests passed; lint/TypeScript/build and preserved executable diagnostic passed. Windows ZIP unchanged. No public URLs, deployment, physical cross-network transfer or TURN success yet. See [current evidence and authorization gate](PUBLIC_DEPLOYMENT_READINESS.md) and [deployment procedure](FREE_HOSTING.md). Earlier records below are historical.

---

# Integrated 0.4.0 — INTEGRATED-20261016.1

Current source starts at `b1a3ec2`; the earlier split and working LAN checkpoints are preserved. Desktop and Web now both expose Optical Share and Send Later — Coming Soon. Online adds six-digit temporary codes (10-minute TTL), existing strong room IDs/capabilities and owner approval, cooperative in-session pause/resume, safe text copy/clear/history controls, transfer metadata and measured speed/ETA. Progress stays below 100% until integrity verification. Interrupted WebRTC files still require whole-file resend; in-flight chunks may settle after pause. Resume on the device that paused.

Optical version-1 text remains compatible and version-2 supports files up to 64 KiB. The same QR decoder accepts camera frames or imported images and supports repeated, missing, duplicate and out-of-order frames. Existing offline LAN routing, pairing, resume and firewall/adapter logic are unchanged. See [Optical guide](OPTICAL_SHARING_GUIDE.md) and [current verification](INTEGRATED_VERIFICATION.md).

Send Later is a visible non-upload Coming Soon screen in shipping builds. No cloud API is called by that screen, no new database/storage/payment dependency is added, and the public Nginx `/cloud/` route returns 404. Legacy implementation and its explicitly local combined regression host are retained; it is not part of the shipping website/desktop feature set. No cloud service was deployed.

Public deployment and Internet/TURN/physical-device verification remain open. No push, publication, public deployment or expenses were authorized or performed.

---

# 0.4.0 product separation — SPLIT-20261015.1

Desktop Offline LAN, Online Web and public signaling have independent targets. Implementation/local tests advance, but the website is NOT DEPLOYED or INTERNET VERIFIED. Free hosting authorization/account access, actual cross-network phone acceptance and successful public TURN relay remain external gates. See [current evidence](SPLIT_VERIFICATION.md), [boundaries](PRODUCT_SEPARATION.md) and [hosting steps](FREE_HOSTING.md). Do not describe this checkpoint as a production release.

---

# 0.3.2 Online Sharing — ONLINE-20261015.1

**IMPLEMENTED and LOCALLY TESTED; NOT INTERNET VERIFIED or production ready.** The desktop now requires an explicitly configured, healthy hosted HTTPS service instead of attempting its absent local `/signal`. Public room invitations/QR, shared authenticated multi-transport TURN configuration, relay-only controls, route/error diagnostics and an optional HTTPS deployment overlay are implemented. Offline LAN is preserved and the rebuilt executable passes native LAN checks.

Current source, artifact evidence and remaining mandatory gates are in [ONLINE_SHARING_VERIFICATION.md](ONLINE_SHARING_VERIFICATION.md) and [ONLINE_0.3.2_EVIDENCE.json](ONLINE_0.3.2_EVIDENCE.json). Public DNS/TLS/WSS deployment, successful browser TURN relay, different Internet networks, new-build physical devices and clean Windows remain open. The local positive relay attempt fails with coturn UDP `Operation not permitted`; authenticated allocation alone is not a relay pass. The user reports prior 0.3.1 PC/phone LAN success, which is not new-build physical verification. Historical entries below retain their original scope.

---

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
