# UI polish public deployment — 2026-10-18

The user explicitly requested deployment after disclosure of the unresolved public close-frame limitation. This deploys the verified UI; it does not waive or mark the strict close-frame verification as passed, nor establish full release readiness.

## Actual deployment

- Website: https://flowdrop-online.pages.dev/
- Pages project: existing `flowdrop-online` in the user's account, Free/manual workflow.
- Frontend source: `bd829d53a29ab8ee3f2cda82da79c64a7fc9d841` (includes UI implementation `bf7d8f5`).
- Production deployment: `872a1393-a29d-46e8-878d-895549bfaa11`, successful in 44 seconds, October 18 at approximately 19:49 Asia/Kolkata.
- Production app module: `/assets/index-XSOlF0-V.js`; stylesheet `/assets/index-CFC6uY-P.css`.
- Backend: https://flowdrop-signaling.onrender.com/signal , existing Render Free source `1c4d7e4`, deployment `dep-dbad6sfbtjjs73emv6lg`.
- Previous production frontend is preserved for rollback: `35f51697-1f2d-409f-86e7-10f3ff1010ba`, source `8076ed5`. Older rollback `ec70164f-7da3-4e45-85b8-b16d90791fc5` remains available.
- Automatic Git deployments remain paused. No billing, plan changes, new services, public secrets or Windows binary rebuilds.

## Live verification

HTTP 200 for website and backend health; production metadata uses the correct public HTTPS signaling endpoint. Actual served application module contains the new invitation dialog and Optical flow switches. Browser inspection confirms the new Send via Screen / Receive via Camera interface and Home navigation. The first standalone asset check selected the separate theme initializer rather than the application module; correcting script selection verified the actual app bundle. This was a verification-script selection error, not a deployment error.

The unchanged `scripts.verify_rooms_deployment.py` ran against production. Earlier assertions for metadata, HTTPS health, exact CORS, room create/join, authenticated WSS rosters, rename/addressed signaling, lock, guest-admin denial and invitation rotation passed before the mandatory close assertion failed: the removed event arrived, but the client received no close frame (1006). The checker exited 1; no all-green public security acceptance is claimed. Revoked-credential verification is covered by separate local and browser scenarios; the checker does not reach its final post-close assertion on this failed run.

Full hosted browser results are appended below. These use the real public HTTPS/WSS services and real browser DataChannels between contexts on this PC. They are not physical PC/phone cross-network or TURN verification. Optical camera video is synthetic and QR image import is automated; neither is a physical phone-camera test.

## Known limitations

The public close-frame issue remains escalated to Render's human support team. The origin logs a completed 4003 close while public clients observe 1006. The new frontend handles explicit membership removal as terminal, but that behavior does not turn the failed protocol gate into a pass. Single-instance rooms remain restart-sensitive; TURN is not configured. Physical Internet transfer and camera acceptance are outstanding. Vite bundle-size and transport deprecation advisories remain recorded.

Local pre-deployment evidence: 23 Online browser tests, eight desktop/LAN browser tests, 31 frontend units and 91 backend tests passed; seven infrastructure skips. Lint, TypeScript and guarded production builds passed. See `UI_POLISH_VERIFICATION.md` and `PUBLIC_CLOSE_DIAGNOSIS.md` for details.


## Initial hosted regression result and follow-up — 2026-10-19

Initial deployment bd829d5 / 872a1393: 21 passed, one failed, one expected local-clock-only skip (4.5 minutes). The 64 KiB optical recovery case passed in 49.7 seconds. Invitation modal, actual text receipts, receiver approvals, actual byte verification, multi-recipient delivery/retry, pause/resume/cancel, interrupted negotiation recovery and responsive/theme checks passed. The named-room scenario failed only at its final End Room assertion: a peer did not promptly show the ended terminal state. This is not an all-green hosted result.

Confirmed cause: unlike host removal, room-wide end still depended entirely on receiving WebSocket close 4001. The known public control-frame loss could leave clients reconnecting rather than immediately displaying the terminal room state. The correction emits an explicit ended event to all sockets concurrently, before waiting for bounded close handshakes; room and invitation are invalidated before yielding. Clients treat ended as terminal, clear cached credentials, destroy peer transports and stop retries. Close code 4001 is retained, and the independent mandatory close-frame verifier is not weakened. A backend regression requires the ended event, actual local 4001 close and revoked credentials. The full backend suite passed: 92 tests, seven infrastructure skips. ESLint, TypeScript and Online build passed. Follow-up local and public results are recorded below when complete.


## Corrective deployment — 2026-10-19

Source `28b151bd40ab74d072f5cb56c0b4b0f88a28d4da` is deployed backend-first: Render `dep-dbahlh4s728c73ai2gt0` succeeded in 1m07s; Pages `119887c9-0516-401b-96b8-f857e95bd88c` succeeded in 39 seconds at approximately 00:48 Asia/Kolkata. Existing Free projects and manual workflows are unchanged. Exact live module `/assets/index-g0lO8sl1.js` and the correct production signaling URL were verified over HTTPS.

Before frontend release, a disposable public WSS check received the ended event and confirmed revoked room access and invitation reuse both returned 404. This is application-level verification, not successful close-frame acceptance. The final unchanged strict verifier was run again and still exited 1 at the mandatory missing-close-frame assertion (1006). No requirement was removed or softened. Render human support remains pending; its latest visible message was still the escalation acknowledgment.

Local correction checks: seven room/host-control browser tests passed (44.5 seconds); a stronger named-room case withholding all close-event notifications from the app passed (22.7 seconds including harness startup), requiring the explicit ended event exactly once. Backend: 92 passed, seven infrastructure skips (7.28 seconds). Frontend units: 31 passed (13.90 seconds). ESLint, Ruff, TypeScript, Online build and guarded Pages build passed. The source change affects no optical codec or desktop executable; prior LAN regression evidence is retained.

Rollback: immediate prior Pages `872a1393-a29d-46e8-878d-895549bfaa11` / source `bd829d5`, previous backend `dep-dbad6sfbtjjs73emv6lg` / source `1c4d7e4`. Earlier working checkpoints remain available.


## Final hosted result

**22 passed, one expected local-clock-only skip, 3.9 minutes**, exit 0, `.flowdrop/room-ended-public-final`. The formerly failing named-room/End Room case passed in 31.6 seconds with close notifications withheld and exactly one actual ended message required. The complete hosted suite also passed file/text delivery, independent recipient transfers/retries, pause/resume/cancel, removal/revocation, invitation modal cancel/error/retry/rotation, reconnection, theme/axe/mobile layout, QR pairing and optical recovery. The final exact 64 KiB image reconstruction case passed in 54.6 seconds with matching downloaded bytes and SHA-256, including selective missing-frame replay. These are same-PC automated browser tests through public services, not physical cross-network acceptance.

The strict standalone HTTPS/WSS verifier remains a separate **failure** at the missing 4003 close frame. The successful application-event/browser checks do not replace that gate. The public application is deployed with that known limitation under explicit user authorization; full production readiness is not claimed.

Final evidence screenshots: `.flowdrop/room-ended-pages-live.png`, `.flowdrop/room-ended-live-home.png`, `.flowdrop/room-ended-public-invitation.png`, `.flowdrop/room-ended-public-mobile-chat.png`, `.flowdrop/room-ended-public-optical-64k.png`. Invitation retry screenshot includes an intentionally injected test HTTP failure, not a claim of a production outage. Windows ZIP SHA-256 remains `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`.
