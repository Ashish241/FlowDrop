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

# Public deployment execution — 2026-10-16

Source checkpoint `c47cc16fd4896e2091040403b63298451786b786` pushed to the existing private `Ashish241/FlowDrop` repository, branch `master`, with explicit owner authorization. Actions was temporarily disabled for this push and restored to its original enabled/all-actions/no-SHA-pinning settings. No CI run was triggered. No repository or release was replaced.

## Assigned services

- Render Free: https://flowdrop-signaling.onrender.com
- Signaling base: https://flowdrop-signaling.onrender.com/signal
- Render service: `srv-db8it65g1s2s73e0q5qg`; first deploy `dep-db8it6lg1s2s73e0q6t0` from `c47cc16`.
- Cloudflare Pages project: `flowdrop-online`; assigned origin https://flowdrop-online.pages.dev. Production deployed successfully by Direct Upload (no Git integration). Deployment `a58697d1-bd04-48dc-bdd8-dddcd67a9de4`; Pages production branch label `main` is upload metadata, while source checkpoint is repository `master` at `c47cc16`. Use the canonical origin, not the deployment-specific preview hostname, for signaling CORS.

Render uses the owner's confirmed My Workspace, Python 3, Free 512 MB / 0.1 CPU, one uvicorn worker, no proxy-header trust, bounded frame/concurrency settings, health `/signal/health`, auto-deploy Off, exact Pages origin, Cloudflare STUN and ICE policy all. No Redis/database/S3/TURN credentials, billing change, paid compute, custom domain or new repository was added.

## Actual checks executed

- Public HTTPS `/signal/health`: 200, signaling protocol 1, STUN true, TURN false.
- Public authenticated WSS: temporary owner room, six-digit join, pending receiver and owner approval passed; temporary room revoked afterward. No tokens/codes saved.
- Public exact-origin preflight passed; untrusted Origin room creation returned 403.
- Public `/api/health` and `/cloud/health`: 404, preserving backend separation.
- Real production `npm run build:pages`: TypeScript and Vite passed with assigned Render endpoint; generated metadata and exact HTTPS/WSS CSP passed; bundle local URL literal scan passed.
- Upload artifact `.flowdrop/FlowDrop-pages-production.zip` contains static site files at archive root. It was uploaded and deployed after the owner enabled the required browser extension permission.
- Windows ZIP unchanged: SHA-256 `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`.

- Public deployment verifier passed on the actual Pages/Render endpoints: frontend assets/configuration, exact HTTPS/WSS CSP, local-URL literal scan, health, CORS, authenticated WebSockets, six-digit join, owner approval and synthetic metadata routing. Evidence `.flowdrop/public-verification.json`; no physical cross-network claim.
- Actual rendered Edge website: homepage/Optical Share/Send Later Coming Soon visible; room created, receiver joined via six-digit code, owner approval and Direct P2P connection succeeded.
- Text and one synthetic 65,536-byte file transferred between two Edge tabs on this same PC using the deployed website/backend. Receiver reported SHA-256 verified; saved Downloads/public-smoke.bin hash independently matched source: `7DACA2095D0438260FA849183DFC67FAA459FDF4936E1BC91EEC6B281B27E4C2`. This is real WebRTC with hosted signaling but same-PC peers, not different-network/device acceptance.
- Browser download-event observation timed out; the file was nevertheless saved and its hash checked directly. A full-page screenshot attempt timed out; viewport screenshot captured separately. The test room was ended afterward.

## Pending gates

Physical cross-network PC/phone transfer, mobile saved-file behavior and long-lived/cold-start recovery acceptance remain open. No physical cross-network PC/phone or TURN relay success is claimed. Render Free sleep/restarts lose memory rooms; STUN alone cannot traverse every NAT/firewall. Shared proxy rate aggregation remains a preview capacity limit. Existing local automated and desktop regression evidence is in PUBLIC_DEPLOYMENT_READINESS.md.
