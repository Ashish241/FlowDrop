# UI consistency, loading and chronological chat — 2026-10-19

Continues checkpoint `6f4ec30`; previously deployed frontend `28b151b` / Pages `119887c9-0516-401b-96b8-f857e95bd88c` remains available for rollback. This change does not rebuild Windows binaries or change Offline LAN bindings, authentication, signaling protocol, transfer encryption, optical codec, STUN/TURN, hosting plans or automatic deployment settings.

## Implementation and async audit

| Action / operation | Feedback and correctness |
| --- | --- |
| Create / join room | Shared LoadingButton with Creating room / Joining room labels; existing entering ref blocks duplicate requests; existing 70-second request timeout; error restores controls. |
| End / leave room | Shared centered confirmation; Ending room / Leaving room; in-flight ref; modal remains open through HTTP acknowledgement, even when the terminal WS event arrives first; retryable inline error; successful cleanup navigates Home. |
| Remove device | Shared destructive confirmation; Removing device; existing host-request ref; waits for authenticated DELETE; error stays inline. |
| Refresh invitation | Same shared dialog, refresh icon and pending button; server acknowledgement updates code/expiry; QR effect rejects obsolete results; inline retry. |
| Rename, lock / unlock | Ref guards a pending control; Updating name / Locking room / Unlocking room; roster acknowledges requested value; ten-second timeout and server errors stop loading; no optimistic success. |
| Restore membership / reconnect | Existing bounded authenticated recovery and explicit terminal handling retained; branded page-variant loader in recovery banner preserves workspace and attachments. Failed connection offers Retry. |
| Retry peer negotiation | Existing peer state and generation checks retained; Connected Devices shows Connecting / Reconnecting. No fake byte progress or repeated offer allocation. |
| Choose / send files | Existing per-recipient Preparing state, attempt guard, receiver approval and real byte progress retained. Receiver hash/sink setup now has section loading and duplicate-accept guard. |
| Pause / resume / cancel online transfer | Pause/resume are synchronous DataChannel commands with existing transfer state/progress. Active cancellation now requires shared confirmation; no artificial spinner on synchronous commands. |
| Send text | Synchronous per-recipient DataChannel send, followed by actual receipt counts; no artificial spinner. |
| Copy / download prepared browser blob | Existing clipboard error/toast and browser save handoff retained; no claim that a disk save is confirmed. |
| LAN pairing | Requesting connection, ref guard, 70-second timeout and error cleanup. |
| LAN accept / pause / resume / save outcome / download ticket / retry | Shared LoadingButton follows the actual returned promise and guards duplicate click dispatch; existing error reporting; API combines session cancellation with 70-second deadline. |
| LAN file selection / original-file recovery | Existing hashing preparation status uses shared section loader; reselect verification now reports the file being checked and guards repeated recovery of the same transfer. Existing real upload progress retained. |
| Optical build | Preparing QR frames, ref guard, completion/error cleanup. Existing QR dwell starts on actual image load, not a loading animation. |
| Optical decoder startup | Shared section loader until worker ready; terminal decoder error stops it. |
| Camera / feedback camera / invitation scanner | Starting camera feedback; generation guards; shared 30-second permission timeout releases late streams. Stop cancels obsolete startup and restores controls. No physical camera verification claimed. |
| Optical frame decode / reconstruction / recovery | Existing received/missing/duplicate/recovered counters, serialized processing and verification statuses retained. Recovery-frame selection is synchronous and gets no fake wait. |
| Verify reconstructed optical file | Branded section icon inside the existing live status, with finally cleanup; SHA-256 mismatch still disables download. |
| Clear local chat history | Shared destructive confirmation in room, LAN and existing peer transfer views. |
| Send Later | Remains Coming Soon; no new cloud feature or service. |

Shared components live in `apps/web/src/ui/shared.tsx` and `shared.css`: ConfirmDialog, LoadingButton, FlowDropLoader (button/modal/section/page), SectionLoader and BackNavigation. Native HTML dialog provides top-layer focus trapping; Cancel receives initial focus, Escape is blocked while pending, and focus returns to a still-mounted trigger. Shared CSS inherits Online theme tokens and provides desktop dark-mode fallback. Existing notification ownership remains local; informational toasts do not become dialogs. Animations use transforms/opacity and honor reduced motion.

## Navigation and chat

Navbar Back to Home is removed. Create/join setup, room workspace, Optical landing and secondary optical screens use body navigation. RoomDashboard remains mounted when hidden, preserving File objects and live peer connections. Optical remains mounted after first visit, preserves selected input and reconstructed data, pauses frames/stops camera when hidden, and uses explicit send/receive hash routes for browser Back/Forward. Join hash changes reset temporary code/error/scanner state.

Root cause of chat order: new messages were prepended with `[newMessage, ...oldMessages]` and rendered using array indexes. Room chat now appends in arrival order, retaining the latest 30. Outgoing UUIDs remain stable; incoming IDs are scoped by sender; duplicate retained wire messages are ignored. Receipt updates map in place. Equal timestamps cannot reorder messages because timestamps are not used to sort. Auto-scroll follows only when already within 64 px of bottom. Incoming/outgoing compact safe text bubbles and bottom composer are retained. The existing legacy peer received list also appends chronologically. Old wire messages without an ID get a generated arrival ID; replay deduplication requires the modern ID-bearing protocol.

## Verification status

Initial full browser run: 24 passed, two failed. Failures were a duplicated optical verification live-status region (fixed by one status with branded icon) and a pre-existing test expecting newest-first ordering (updated to newest-last). No protocol gate was relaxed.

Final local/public results and deployment identifiers are appended after execution. New tests cover held create/end requests, Cancel/focus restoration, Escape while pending, retry after 503, reduced motion and themes, optical back/input persistence, actual peer message ordering/replay/scroll, and camera timeout/retry with a synthetic permission stub. Existing regressions continue to require actual transferred bytes and SHA-256.

## External limitations

The existing public server-initiated WebSocket close-frame gate remains unresolved: explicit terminal events work, but public clients can receive 1006 instead of the actual required close code. Strict verifier remains unchanged. Render human support escalation is pending. Rooms remain in memory on one Free instance and cannot survive backend restarts. TURN is not configured. Physical PC/phone cross-network transfers and real camera scanning remain unverified. Vite large-bundle and dependency transport deprecation warnings remain. No production-readiness claim is made.

The original nine sharing browser regressions also passed (27.8 seconds), including LAN bytes/text, original two-peer WebRTC bytes/integrity/navigation/reconnect/cancellation, internal encrypted upload/download/revocation and resumed encrypted upload. These run only on the disposable loopback fixture; Send Later remains unavailable on the public product. Additional harness corrections scoped reduced-motion assertions to the visible button and captured both locally created and remotely offered DataChannels, because either peer may legitimately initiate negotiation. Receiver preparation now uses one existing live status with a branded icon, preventing duplicate status announcements.

## Final local checks

27 Online browser tests passed together (2.3 minutes); eight desktop/LAN browser tests passed (26.3 seconds); nine original sharing regressions passed (27.8 seconds). Frontend: 34 unit tests across 14 files, ESLint, TypeScript and general/Online/desktop web builds passed. Backend: 92 passed, seven infrastructure skips (8.49 seconds); Ruff passed. The final 64 KiB optical loss/recovery run passed in 51.3 seconds with exact bytes/SHA-256; this is automated image recovery on this PC, not physical-camera throughput. Windows ZIP SHA-256 remains CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18.

Guarded Pages production build passed with `VITE_SIGNAL_URL=https://flowdrop-signaling.onrender.com/signal`; public HTTPS configuration and CSP are preserved. Local production app module is `/assets/index-qbdQIoAV.js`.

## Changed files

Application: `apps/web/src/{online-main,room-dashboard,online,optical,invitation-scanner,main}.tsx`; shared UI: `apps/web/src/ui/{shared.tsx,shared.css,camera.ts,camera.test.ts,chat.ts,chat.test.ts}`. Browser coverage: `apps/web/e2e/{ui-consistency,rooms,delivery,product-polish,workspace,sharing,online-product}.spec.ts` and `playwright.{rooms,public}.config.ts`. Documentation: this report/JSON plus `TEST_REPORT.md`, `RELEASE_READINESS.md`, `IMPLEMENTATION_STATUS.md`, `PUBLIC_DEPLOYMENT_STATUS.md`. No backend or Windows release files changed.
