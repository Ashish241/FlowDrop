> **Current preview, 2026-10-20:** Online source `e17ca47` is live on Pages (`8ef3e6b2`); verified Windows `v0.4.2-preview.1` is published from `6905d40`. Local: 92 backend passes / 7 external skips, 35 units, 32 Online, 9 desktop and 20 integrated browser passes / 1 TURN skip. Hosted full run: 30 passes / 1 fixture race / 1 expected skip; corrected recovery fixture passed 3/3 public reruns. User reports public PC-screen → phone-camera Optical “all working”; detailed phone/hash telemetry was not supplied. Strict public close-frame gate remains failed; TURN and other physical acceptance remain external limits. See [current report](OPTICAL_WINDOWS_RELEASE.md) and [results](OPTICAL_WINDOWS_VERIFICATION.json). All older notices below are historical.

> 2026-10-19 final UI consistency update: Online source 7612991 is deployed manually on Pages (f85d4ce5), with 26 hosted browser passes / 1 expected skip. Local checks include 27 Online, 9 desktop/LAN and 9 original sharing browser scenarios, 34 frontend units and 92 backend passes / 7 infrastructure skips. LAN cancellation source is also verified; Windows binaries are preserved. The strict public close-frame gate still fails. See [UI_CONSISTENCY_VERIFICATION.md](UI_CONSISTENCY_VERIFICATION.md) for the audit, evidence, source/deployment distinctions and external blockers.

> **Current deployment, 2026-10-19:** Both public services run source `28b151b`; Pages `119887c9-0516-401b-96b8-f857e95bd88c`, Render `dep-dbahlh4s728c73ai2gt0`. End Room now sends an explicit terminal event. Final hosted browser result: 22 passed, one expected local-clock-only skip (3.9m). Backend: 92 passed/seven infrastructure skips; units: 31 passed. The independent public 4003 close-frame gate remains failed (1006) and escalated to Render. No physical/TURN or full production-readiness claim. Existing free/manual hosting and Windows artifacts are preserved. See [deployment report](UI_POLISH_DEPLOYMENT.md) and [results](UI_POLISH_DEPLOYMENT.json). Earlier entries are historical.

> **Live UI deployment, 2026-10-18:** At the user’s explicit deployment request, UI polish is now live at https://flowdrop-online.pages.dev/ from `bd829d5`, Pages deployment `872a1393-a29d-46e8-878d-895549bfaa11`. Automatic deployments remain paused; Windows artifacts are preserved. The strict public close-frame gate remains failed (1006), with Render support escalated. Deployment is not a claim that all release gates passed. See [deployment report](UI_POLISH_DEPLOYMENT.md). Earlier entries below are historical.

> **Close-path investigation update, 2026-10-18:** Backend `1c4d7e4` is live (`dep-dbad6sfbtjjs73emv6lg`). New real-TCP and privacy tests passed; backend total is 91 passed/seven infrastructure skips. Origin now logs completed 4003 without application cancellation, but public client still observes 1006. The strict gate remains failed and UI polish remains undeployed. See [diagnosis](PUBLIC_CLOSE_DIAGNOSIS.md) and [submitted support case](RENDER_CLOSE_SUPPORT_DRAFT.md).

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

# 0.4.0 independent applications

Separate desktop/online Vite targets, artifact boundary checks, offline-only launcher resources, dedicated responsive online website, minimal one-worker public signaling, exact-origin cross-service policy and prepared free hosting are implemented. Existing transfer/LAN/cloud source and regression fixture are preserved. See PRODUCT_SEPARATION.md and SPLIT_VERIFICATION.md. Internet deployment/physical acceptance remain unverified.

---

# 0.3.2 Online Sharing implementation

Explicit desktop URL settings, host authorization, bounded cached health probes, HTTPS handoff and unavailable/error UI replace the packaged localhost signaling assumption. The hosted client retains its existing WebRTC protocol and adds room invitation links/QR, validated endpoint-scoped recovery, authenticated multi-URL STUN/TURN, relay-only controls and selected-candidate route diagnostics. Signaling responses cannot cache credentials. The public HTTPS edge overlay preserves exact-origin/proxy trust rather than broadening CORS/CSP.

Local browser transfers, exact packaged handoff, provider integrations and native LAN regression pass. Public service provisioning and Internet/mobile/working browser relay acceptance remain BLOCKED. See [verification](ONLINE_SHARING_VERIFICATION.md) and [operator guide](ONLINE_SHARING_GUIDE.md).

---

# 0.3.1 native LAN recovery

Windows hardware/route/profile inventory, ambiguity handling, validated adapter identity preferences, dual local/LAN listeners, available-port recovery, readiness-gated host browser, native QR/diagnostics, explicit UAC firewall setup and build manifests are implemented. See [LAN_CONNECTIVITY_VERIFICATION.md](LAN_CONNECTIVITY_VERIFICATION.md) for actual tests and physical/UAC gates.

---

# Implementation status

Updated: 2026-10-13. Engineering version: 0.3.0.

## v0.3.0 release engineering

Implemented Redis-backed room/session authority, atomic join/approval, TTL expiry, generation-based socket replacement, owner revocation, cross-instance routing and distributed abuse counters with fail-closed operation. Memory mode remains explicitly single-instance development. Real Redis tests include closing a live authorized socket after revocation and preserving rooms across worker restart.

Disposable native PostgreSQL 18 migrations/concurrency, Garage 2.4.1 private S3 operations/failures/cleanup and current coturn 4.18.0 allocation/authentication/ACL checks passed without changing the installed PostgreSQL service or installing WSL packages. Docker remains unavailable; alternative local resources were inspected and used. Supported container manifests are digest-pinned; disposable integration Compose and CI harnesses are provided, not remotely run.

Capability-scoped IndexedDB source recovery is implemented for LAN, WebRTC resend and Send Later. LAN has round-robin chunk admission, cached-file retry and byte-accurate progress; online panels survive navigation, renegotiate fresh peers on reconnect and retain pending files. Dashboard participants/rates/ETA/state and explicit receiver save reporting are implemented; zero-byte progress and short final chunks are handled. Browser persistence can fail under quota; source reselect remains available.

Verified: 21 baseline + 6 real-infrastructure Pytest, 9 Vitest, 13 Playwright; cloud browser scenarios additionally run against real PostgreSQL/Garage/Redis. Lint/strict build/audits, 1 GiB/four-client loopback benchmark, Windows build/version/frontend/worker and graceful shutdown smoke passed. See TEST_REPORT.md and INFRASTRUCTURE_VERIFICATION.md for exact scope.

**Not a verified public RC / not production ready.** Physical/clean-PC/GUI acceptance, real Internet TURN/TLS, Docker builds/CI and production HA/security signoff remain open. Known product limits include byte-zero WebRTC restart, one managed cloud share per tab and no user queue reordering. No remote push, publication, paid infrastructure or public deployment occurred. The older sections below are historical, superseded where the v0.3.0 evidence differs.

## v0.2.0 continuation

The clean 780ed3f baseline was rerun successfully (16 Pytest, 7 Vitest, 11 Playwright). Added tab-scoped online transfer history; mounted active panels survive navigation; saved signaling capabilities allow explicit refresh reconnection; separate-context WebRTC reconnect/text tested. The sender waits for verification before advancing its file queue; relay diagnostics inspect both candidates.

Send Later stores one managed share/key/nonce in the originating tab, checks the full original-file hash before retry, retrieves sender-only chunk checkpoints, pauses requests and retains link/revocation across refresh. Optional download-session limits use independent expiring hashed leases and atomic database coordination. Browser interruption/refresh/changed-file tests passed. Closing a tab still loses capabilities; no cross-tab/user capability sharing is introduced intentionally.

LAN assembly disk failures now recover without restart. Cloud writes/read failures are retryable, uploads timed/bounded, local objects staged atomically, unauthorized IDs cannot allocate locks, and forwarded IPs require explicitly trusted direct peers. Added internal security review, known limitations, physical acceptance and rollback instructions. Backend now has 21 passing tests; final full frontend/packaging evidence is in TEST_REPORT.md.

Alembic 0002 applied to disposable SQLite. Docker engine remains unavailable; PostgreSQL/S3/TURN/TLS/Redis distributed behavior is unverified or incomplete. Not production ready. Sections below retain the prior implementation history; superseded remaining-work statements should be read with this continuation and KNOWN_LIMITATIONS.md.

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
