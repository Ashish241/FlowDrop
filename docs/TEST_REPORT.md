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

# Integrated 0.4.0 / INTEGRATED-20261016.1 — 2026-10-16

77 backend tests passed (7 unconfigured provider tests skipped); 4 real Redis integration tests passed separately. Eleven frontend unit tests, 13 product browser scenarios and 20 preserved combined browser scenarios passed; one positive relay case remains conditionally skipped/unverified. Lint, strict TypeScript, production builds, artifact boundaries, rebuilt Windows smoke/native LAN/binding checks and extracted backend smoke passed. Optical tests decode actual QR rasters/PNG frames offline and reconstruct bounded binary data; camera UI errors are simulated, not physical-camera evidence. No public deployment or cross-network Internet test occurred.

Full scope, warnings, earlier harness failures, actual artifacts and remaining gates are in [INTEGRATED_VERIFICATION.md](INTEGRATED_VERIFICATION.md) and [INTEGRATED_0.4.0_EVIDENCE.json](INTEGRATED_0.4.0_EVIDENCE.json). Previous records below are historical.

---

# 0.4.0 / SPLIT-20261015.1 — 2026-10-15

74 Pytest passed; six unconfigured provider tests skipped (not rerun for this memory-only product split). Nine Vitest passed. Preserved combined browser suite: 20 passed, one conditional relay skipped (1.6 min). Dedicated Online website: three passed (12.9s); Desktop offline target: five passed (14.6s), including repeated existing LAN scenarios. Ruff check/format, ESLint, strict TypeScript, all three production builds and bundle-boundary checks passed. Website screenshot/layout inspected; five responsive widths and automated accessibility passed.

Windows executable/ZIP rebuilt with offline resources only; exact extracted build manifest/version, API/frontend/shutdown, native QR/256 KiB hash-matched LAN download/authenticated socket/restart and loopback/selected/Wildcard bindings passed. A previous baseline diagnostic safely refused automatic selection when Windows routing/profile inventory temporarily failed; subsequent final native checks passed without changing network architecture or policy. Extracted minimal signaling artifact passed a separate real-process HTTP/room/CORS/no-desktop smoke. Remote CI, Docker runtime, provider deployment, public Internet, new physical phone and clean Windows were not tested.

The dedicated online test verifies actual multiple and reverse files, text, cancellation, refresh/reconnect and deliberately corrupted bytes causing hash failure and an aborted browser download. Earlier test-harness room-code race/variable/port assumptions were corrected; final runs passed. Positive browser TURN remains unresolved, not counted as success. See [complete scope](SPLIT_VERIFICATION.md), [artifact/binding evidence](SPLIT_0.4.0_EVIDENCE.json), and [deployment authorization/steps](FREE_HOSTING.md). Expected Starlette/TestClient and Windows socket-closure warnings are documented there.

---

# 0.3.2 / ONLINE-20261015.1 — 2026-10-15

| Check | Actual result | Scope |
|---|---|---|
| Backend regression | 72 passed, 6 unconfigured integration cases skipped | Full suite; provider cases run separately below. A sandbox-restricted attempt failed/hung on local socket access and was interrupted; the unrestricted final run passed. |
| Disposable real infrastructure | 6 passed (10.23s) | Redis multi-instance signaling/expiry/revocation/rates, PostgreSQL migration/concurrency, Garage private S3 lifecycle/failures and coturn allocation/auth/ACL. |
| Frontend unit | 9 passed | Existing hashing/encryption/optical/fair scheduling regressions. |
| Browser full suite | 20 passed, 1 conditional positive relay case skipped (1.6 min) | LAN approval/privacy/queue/QR, online gating/outage/relay refusal, WebRTC files in both directions/reconnect/cancel, Send Later, accessibility and responsive widths. |
| Separate browser processes | Passed | Two actual Chromium processes, 16 MiB + 17 byte saved file byte comparison and reverse URL sharing. Included in full suite, not an extra unique test. |
| Exact packaged hosted handoff | Passed | Repeat separate-process scenario starting from the extracted executable, explicitly loopback development service. Not an Internet test. |
| Positive browser relay attempt | FAILED / BLOCKED | Authenticated allocations and permissions succeed; coturn relay forwarding logs UDP `Operation not permitted` and ICE fails. Separate attempted gate, not a success or silently omitted test. |
| Static and production | Passed | Ruff check/format, ESLint, strict TypeScript, Vite production build and Git whitespace checks. |
| Deployment syntax | Passed; runtime blocked | Base + public HTTPS overlay + TURN profile parse, coturn `sh -n`, Caddy manifest digest recorded. Docker engine/runtime and public TLS not run. |
| Windows exact package | Passed | PyInstaller rebuild, version/build/manifest hashes, startup/API/frontend/download worker/graceful shutdown; native hidden Tk/QR/LAN 256 KiB hash-matched file/socket/restart; TCP loopback/selected-LAN/wildcard plus Public-profile auto-selection refusal. |

Current evidence: [ONLINE_SHARING_VERIFICATION.md](ONLINE_SHARING_VERIFICATION.md), [artifact/binding record](ONLINE_0.3.2_EVIDENCE.json), [setup](ONLINE_SHARING_GUIDE.md). Expected warnings remain: Starlette/httpx TestClient deprecation and PyInstaller optional-platform/import warnings; exercised packaged API/WebSocket/Tk paths pass. No dependency vulnerability audit was newly performed for this change (no dependency additions); earlier audit records retain their dates.

No public signaling service or Internet TURN was configured/deployed. No physical phone, actual camera scan, clean Windows install or separate Internet networks were tested on 0.3.2. User-reported physical LAN success belongs to the 0.3.1 baseline. The local native DHCP notification is mocked and labeled as such; network bindings and downloaded payload checks are real same-PC operations. Test-only services were stopped after integration verification. No public deployment, push, publication or paid provisioning occurred.

---

# 0.3.1 / LAN-20261015.2 — 2026-10-15

50 backend + 6 real provider integration + 9 frontend unit + 15 browser tests passed. Final extracted Windows native-panel, authenticated LAN file/socket, actual binding, restart and ordinary executable smoke also passed. See [LAN_CONNECTIVITY_VERIFICATION.md](LAN_CONNECTIVITY_VERIFICATION.md) for current artifact identity, scope, warnings and remaining physical/UAC gates. Earlier records below are retained as historical checkpoints.

---

# Offline LAN follow-up — 2026-10-15

32 Pytest passed (6 unconfigured provider integration tests skipped), 9 Vitest passed, 14 Playwright passed in 35.7s. Ruff, ESLint, strict TypeScript/Vite, final PyInstaller rebuild and executable smoke passed. Real native socket checks cover loopback, automatic LAN, explicit LAN and wildcard startup; Windows PowerShell confirmed `192.168.1.7:8000` and HTTP health there. Physical phones and interactive desktop GUI were not tested. Full binding evidence and current ZIP checksum are in [LAN_CONNECTIVITY_VERIFICATION.md](LAN_CONNECTIVITY_VERIFICATION.md).

---

## Previous engineering checkpoint record (2026-10-14)

# v0.3.0 verification record

Run initiated 2026-10-13, completed 2026-10-14 on Windows 11, Python 3.14.6 / Node 24.18.0. Starting commit `721668cabd0c47a93ecd1a80e240d8f526e45211`, clean working tree. Baseline independently rerun: 21 Pytest, 7 Vitest, 12 Playwright passed.

| Check | Actual result | Scope |
|---|---|---|
| Pytest baseline | 21 passed; 6 integration tests explicitly skipped when unconfigured | Existing LAN/signaling/cloud regressions, plus recipient-only save reporting and pause/restart rate accounting |
| Real integration runner | 6 passed | Redis 8.0.5 two-instance state/routing/revocation/live socket/expiry/restart; PostgreSQL 18 migration/concurrency; Garage S3 lifecycle/private reads/write failure retry; coturn 4.18.0 authenticated allocation and peer deny |
| Vitest | 9 passed | Existing hashing/AES/optical tests plus fair scheduling/concurrency/failure release |
| Playwright | 13 passed in final full run (52.9s) | Real loopback browser transfers, saved bytes, multi-client privacy, persistent queues, reconnect/resend, backoff, accessibility and five widths |
| Complete cloud browser path | 2 scenarios passed in final provider run (28.4s) | Browser AES → real PostgreSQL/Garage → browser decrypt/saved bytes, recovery/backoff and revocation; real Redis controls enabled |
| Ruff / ESLint / strict TypeScript / Vite | Passed | Current source and production bundle |
| Dependency audit | Python 48 pinned dependencies: no known findings; npm 261 packages: zero findings | Native toolchain/container CVE certification not claimed; Windows lock lacks artifact hashes |
| Alembic | 0002 head on disposable PostgreSQL and existing SQLite fixture | No new schema change beyond 0002 |
| Container manifests / Compose | Seven public manifest digests verified; both configurations parse | Engine missing; containers and remote CI NOT RUN |
| Windows package | Rebuilt; help/version 0.3.0, API, bundled frontend/worker and graceful zero-code exit passed | Temp working directory outside checkout on development Windows; GUI/clean target NOT VERIFIED |

**49 unique automated tests passed across the configured groups.** Repeated provider/browser runs are listed separately rather than inflated into the unique count.

Real-service tests use two ASGI instances and real TCP infrastructure clients. The full browser regression uses actual TCP/WS/WebRTC with Redis and local storage; the additional cloud browser run uses real PostgreSQL/S3. No scenario is labeled physical-device or Internet verification.

NETWORK_BENCHMARK.json records actual loopback HTTP upload, assembly, streamed download hash and cleanup: one 1 GiB file in 32.174s (combined upload+download bytes / elapsed 63.65 MiB/s), four concurrent 128 MiB files in 24.3962s (41.97 MiB/s combined round trip). Observed server RSS growth was 2.10 / 3.02 MiB; client growth 2.21 / 4.60 MiB, sampled every 20ms. Generated bytes and loopback are not physical-network or mobile benchmarks; the client streamed to a hash rather than saving the 1 GiB to disk.

Failures found and corrected: PostgreSQL download-limit locking read order; SDK-wrapped S3 upload failures; sender refresh retaining an old peer connection; status callback overwriting channel-ready text; asynchronous hash/persistence test gating; chunk-count percentages undercounting a short final chunk. Also corrected cancellation and stale approval races, signaling subscription/readiness ordering, and synchronous PostgreSQL row locks blocking an async upload event loop. Upload transactions now own their database locks and storage calls in bounded worker threads, with same-share concurrent duplicate regression coverage. Queue retry and provider failures were retested after fixes.

Warnings retained: upstream Starlette/httpx deprecation, intermittent Windows Python 3.14 Proactor callback on browser teardown, and pip-audit's unhashed-lock warning. Tests were not skipped to hide these. No independent security certification or production-readiness claim is made.

Final Windows archive: `dist/FlowDrop-windows.zip`, 25,224,801 bytes, SHA-256 `A991F760AE11CD58245138F68BB7CF9C6565F712EA6D1C355855447B4DEB1FE0`. v0.2.0 ZIP preserved; its SHA-256 remains `E1CD5C70A698066BC0285BD7A3A3EFDDE34137159C4EA683BA9F1B566DBF77F6`. Final source commit is recorded with the delivered checkpoint.

---

## Historical v0.2.0 record

Final aggregate browser run: **12 passed in 29.4 seconds**, including actual saved-byte checks, encrypted upload interruption/reload/reselection, secret-link refresh, WebRTC navigation/refresh/rejoin/text, multi-client privacy, accessibility and responsive layouts. Portable Windows build and smoke passed (help, API, compiled frontend and worker from outside checkout); ZIP was generated only after smoke success. Physical clean-machine and GUI tests remain NOT VERIFIED.

After the final pause/revocation UI correction, ESLint/strict build passed and both affected browser tests passed (2/2). Final Ruff and Pytest (21/21) passed. Packaging was rebuilt and smoked again. Archive: `dist/FlowDrop-windows.zip`, 25,219,785 bytes, SHA-256 `E1CD5C70A698066BC0285BD7A3A3EFDDE34137159C4EA683BA9F1B566DBF77F6`. Preserved prior archive hash matches `23B26DA0D40990295F46E9C9C4146A78211EC7889688372AD13F4BCDDF0B1B89`.

Date: 2026-10-13. Baseline commit: `780ed3f57a0f80558b038626904122e83c49070c`. Git status was clean before edits. Baseline rerun: Pytest 16, Vitest 7, Playwright 11 passed.

Current backend: 21 Pytest passed. Added assembly disk-full retry without restart, object-store write failure/retry, sender-only upload checkpoints, download session limits/revocation, trusted-proxy spoofing and bounded limiter capacity tests. Ruff passed.

Frontend: Vitest 7 passed, strict TypeScript/Vite and ESLint passed. Browser regression initially passed 11 tests after recovery/navigation changes. Expanded 12-test run passed 11 and failed a test selector that matched two delivered text messages; correcting it produced a passing focused WebRTC test including navigation and peer refresh/reconnect. Interrupted encrypted upload/reselect validation passed in that expanded run. Final aggregate run and Windows packaging results will be appended after execution.

Alembic upgraded the existing disposable SQLite migration database from 0001 to 0002 (head). Real PostgreSQL remains unverified. Docker info failed because `dockerDesktopLinuxEngine` named pipe does not exist; no container integration was executed.

Fresh npm audit: zero vulnerabilities in 261 packages. Fresh Python pip-audit: no known vulnerabilities in the 47 pinned dependency closure; lock has no artifact hashes. These are dependency database checks, not security certification.

Warnings: upstream Starlette/httpx deprecation; occasional Windows Python 3.14 Proactor connection-reset callback on browser teardown. Recorded without suppressing failures. No physical device, clean-machine, Internet/TURN or real cloud storage evidence is claimed.
