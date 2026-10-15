# FlowDrop Online 0.4.1 — investigation and verification

## Reproduced root causes

On the actual 0.4.0 website, selecting `public-smoke.bin` before connecting produced `Error: Connect to a peer first. · Not connected`. The input was cleared and no in-memory queue retained the selected File. Clicking the enabled Cancel control with no active transfer then produced the exact reported `Transfer cancelled · Not connected`. These are confirmed frontend workflow/state failures, not evidence of ICE failure. The prior live hosted same-PC text/file transfer already established that signaling readiness alone was not the file-transfer test.

Code and regression investigation also reproduced one shared limiter budget: room creation, joining, ICE refresh and revocation all consumed 20 requests/minute behind the same peer address. Repeated negotiation/reconnect could exhaust pairing and cleanup requests. The regression failed before the fix and passed afterward. Each operation class is now independently bounded to 20/minute; pairing guessing, exact-origin checks, one-worker memory state and room authorization remain enforced. No arbitrary forwarded IP is trusted. Proxy aggregation remains a capacity limitation.

Browser-worker denial is separately tested, not claimed as the cause on a specific physical phone: registration could fail despite the API existing. Files up to 128 MiB now use a bounded in-memory Save fallback. Multi-file testing found the next offer could replace the prior Save action; consumer downloads now retain individual Save actions, enforce a 128 MiB pending-buffer total and clear at session cleanup. Larger files still require working streaming downloads.

## Changes

Selected files remain queued before pairing and across transient connection failures. Continue creates the room; verified DataChannel open triggers the queue, with fresh receiver acceptance for every file. Pause/resume, cancellation, acknowledgement backpressure, SHA-256 completion, safe retry and source recovery remain implemented. Idle Cancel is disabled/absent. Connection and socket setup have bounded timers. API requests allow a sleeping free service to wake. End-share revocation errors are surfaced rather than claimed as successful cleanup.

The Online-only homepage is reduced to Send/Receive plus secondary text/optical/Coming Soon actions. Send/Receive have staged file/code/approval/progress screens, copy invitation, QR, retained selection and short statuses. Debug room controls, raw IDs, ICE/relay details and download internals are inside collapsed Advanced connection diagnostics. Optical code and Offline LAN architecture are preserved. Send Later is non-upload Coming Soon. Completion describes verified receipt and browser download handoff, not guaranteed disk saving.

## Verification (2026-10-16)

- Backend: 78 passed, 7 unconfigured infrastructure tests skipped; Ruff passed.
- Frontend: 14 unit tests, ESLint, strict TypeScript and production builds passed.
- Online product: 8 scenarios passed, including preconnection multiple files, pause/resume, byte-matched saves, registration-denied fallback, text, responsive layout/accessibility, reconnect/cancel/corruption and service-outage retry.
- Desktop product: 8 passed; optical QR reconstruction uses actual generated images; camera denial is simulated.
- Preserved combined browser suite: 20 passed, 1 conditional positive TURN test skipped.
- Initial sandbox-limited tests could not open required local sockets; rerun with permitted local process/socket access passed. One test selector matched hidden duplicate text and was narrowed. Concurrent Playwright runs collided in a shared artifact directory; final suites use separate output paths. Initial aggregate online run exposed the shared request budget above; it was fixed and the suite passed.
- Windows executable/ZIP not rebuilt. ZIP SHA-256 remains `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`.

## Deployment and external acceptance

Existing URLs: https://flowdrop-online.pages.dev and https://flowdrop-signaling.onrender.com/signal. 0.4.1 is deployed and verified from source `ba587a6482132e49d452fa4f6a7215072110cd5b`. Render manual deployment `dep-db8jehnf3r2c73ag0vh0` succeeded; Pages manual deployment `a6d292a9-4190-4a44-9258-b213779063db` succeeded. Canonical public metadata reports version 0.4.1 and HTML references `index-B3sieGQ3.js`, matching the intended local guarded build. Prior Pages deployment `a58697d1-bd04-48dc-bdd8-dddcd67a9de4` and local production ZIP are retained for rollback. Existing Render Free service is reused with manual deployment; no new project, billing change or paid resource is needed.

No physical devices, different-network PC/phone test, clean Windows target or authenticated TURN service are available. STUN direct-first sharing is retained; no universal reachability is claimed. Free service sleep/restarts erase temporary rooms, and interrupted files require resend. Browser storage recovery is scoped to the room capability; physical mobile lifecycle behavior remains unverified. Follow INTERNET_ACCEPTANCE.md using Wi-Fi vs cellular, record both transfer directions and saved-file hashes without storing invitation credentials.


Deployment note: Pages had been connected to Git with automatic production/preview deployments enabled since the prior run. Both were disabled in the dashboard; build comments were disabled too. The existing project is retained. The first guarded manual build refused to publish because its build environment omitted VITE_SIGNAL_URL (the repository Wrangler configuration declared no build variables). The public endpoint is now explicit in the Linux build command: `npm ci && VITE_SIGNAL_URL=https://flowdrop-signaling.onrender.com/signal npm run build:pages`, root `apps/web`, output `dist-online`. No secret is present in this command. The refusal preserved the previous production deployment. Existing Pages deployments `74376fe4-7cfd-462d-ba4c-ccde3391d291` and `a58697d1-bd04-48dc-bdd8-dddcd67a9de4` remain available for rollback.


## Actual public production acceptance

All **8 public browser scenarios passed** (fresh actual Pages website and Render signaling, no local web server) with `FLOWDROP_PUBLIC_URL=https://flowdrop-online.pages.dev npx playwright test --config playwright.public.config.ts --output ../../.flowdrop/tests-public-final-041`. This includes retained preconnection selections, multiple real file downloads with byte-for-byte checks, browser SHA-256 verification, pause/resume, text, worker-denied fallback with explicit Save actions, reconnect, cancellation, corrupt-byte refusal, responsive/accessibility checks, Optical QR-image reconstruction and Coming Soon. Worker denial, corrupted bytes, camera denial and the outage route are deliberately injected test cases, not observed physical-device faults. All peer browsers ran on this PC. These are production-hosted same-PC tests, not physical Internet/NAT or phone acceptance.

The public HTTP/WSS verifier also passed; metadata/CSP/exact-origin CORS/room approval and synthetic signaling routing were checked separately. Evidence: ONLINE_0.4.1_EVIDENCE.json and ignored .flowdrop/public-verification-041.json. The first production run passed 7 scenarios but one retained-file assertion used the local 5-second timeout while an ICE config request was pending; a 30-second public assertion timeout produced an 8/8 final run without changing application behavior. Application connection timeout remains 45 seconds, socket setup 25 seconds, API wakeup allowance 70 seconds. No benchmark or universal latency guarantee is implied.

Pages automatic production and preview deployments were explicitly disabled, build comments disabled, and Render Auto-Deploy verified Off. GitHub CI was skipped for the source push to avoid unverified paid Actions usage; all executed tests above ran locally against either disposable local servers or real hosted URLs as identified. The original Pages upload ZIP and previous deployments remain untouched. No paid resource or new hosting project was created. Windows executable/ZIP were not rebuilt.


TURN review: existing INTEGRATED_VERIFICATION.md and KNOWN_LIMITATIONS.md record WSL coturn forwarding UDP with `Operation not permitted`. That local fixture failure is unresolved and was not rerun or reclassified as relay success. Public health explicitly reports `turnConfigured: false`. Authenticated TURN support stays in code and pending receivers still cannot obtain relay credentials; no untrusted relay or permanent frontend credential was added. Public service checks do not prove external STUN reachability on every carrier network.
