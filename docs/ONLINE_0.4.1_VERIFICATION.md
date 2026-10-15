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

Existing URLs: https://flowdrop-online.pages.dev and https://flowdrop-signaling.onrender.com/signal. 0.4.1 deployment is pending final production build and live verification at this checkpoint. Prior Pages deployment `a58697d1-bd04-48dc-bdd8-dddcd67a9de4` and local production ZIP are retained for rollback. Existing Render Free service is reused with manual deployment; no new project, billing change or paid resource is needed.

No physical devices, different-network PC/phone test, clean Windows target or authenticated TURN service are available. STUN direct-first sharing is retained; no universal reachability is claimed. Free service sleep/restarts erase temporary rooms, and interrupted files require resend. Browser storage recovery is scoped to the room capability; physical mobile lifecycle behavior remains unverified. Follow INTERNET_ACCEPTANCE.md using Wi-Fi vs cellular, record both transfer directions and saved-file hashes without storing invitation credentials.
