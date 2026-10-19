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

## First deployment and hosted verification

Source `147f091fe9517e800d602b0c07653f62b7c53bf7` was manually deployed to existing Cloudflare Pages Free: `df209ea2-d10b-4dd7-a6a7-c9d31d8279b3`, success in 31 seconds, 09:30 Asia/Kolkata October 19. Actual production module `/assets/index-qbdQIoAV.js`, HTTPS website and production signaling metadata were verified (200). The initial urllib metadata request returned 403; the existing verifier's httpx client and actual browsers successfully loaded it. Automatic deployments remained paused; backend was not restarted or redeployed.

Initial hosted full suite: 25 passed, one failed, one expected local-clock-only skip (5.2 minutes). The failure was a test synchronization problem: the late member had not reached one browser's roster before Clear Selection, so arrival auto-selected that member. The trace records “A selected device is reconnecting. Wait or change your selection.” Send correctly refused the incomplete selection; no reverse offer or download was created. The test now waits for that roster member before clearing, and explicitly requires the late member unchecked and exactly one recipient before Send. The corrected hosted scenario passed in 51.4 seconds (56.6 seconds including browser setup), retaining actual forward/reverse bytes and isolation assertions. No application transfer guard was weakened.

The unchanged strict public verifier exited 1 with `AssertionError: Public transport ended without a close frame`. This is still a failed mandatory gate, not a successful relay or Internet-wide acceptance claim.

After the user resumed following a long pause, a manually opened verification room had expired. Home cleanup still issued a redundant DELETE against already-terminal membership. The follow-up skips that obsolete request for a confirmed terminal session, clears local credentials immediately, and gives terminal exit controls shared loading feedback. A regression ends a real room, blocks any subsequent membership request, and requires the peer to reach Home with zero such requests. Three affected local browser scenarios passed (44.9 seconds); frontend 34 units, lint, TypeScript and Online build passed. The follow-up frontend is being manually deployed; final hosted results are recorded below.

## Final deployed result

- Website: https://flowdrop-online.pages.dev/
- Application source: `7612991f9a5bf863d9eb3b8e01f47012ace15192` (includes shared-UI checkpoint `147f091`).
- Cloudflare Pages Free/manual deployment: `f85d4ce5-7e00-4786-b624-7f34aa905ef4`, success in 25 seconds at 15:07 Asia/Kolkata, October 19. Automatic deployments remain paused.
- Exact served module: `/assets/index-CNvq9Gi3.js`; CSS `/assets/index-CRzQzl2V.css`. Actual HTTPS website, metadata and backend health returned 200. STUN configured; TURN unavailable.
- Existing Render backend remains source `28b151b`, deployment `dep-dbahlh4s728c73ai2gt0`; no backend restart/deploy, billing, plan change or resource provisioning.
- Final full hosted suite: **26 passed, zero failed, one expected local-clock-only skip (4.0 minutes)**. Includes actual byte/SHA-256 checks, multi-device isolation, pause/resume/cancel, invitation rotation, removal, reconnection, chronological/replayed chat, read-position scrolling, confirmation pending/failure/retry, terminal Home cleanup and camera timeout. Hosted 64 KiB image recovery passed in 43.3 seconds. These use this PC's browsers, imported QR images and synthetic camera streams; they are not physical cross-network or phone-camera tests.
- Strict close verifier was rerun after deployment and **still exited 1**: `Public transport ended without a close frame`. Mandatory actual 4003 close receipt was not relaxed. See `.flowdrop/ui-consistency-final-close.log`.
- Immediate frontend rollback: `df209ea2-d10b-4dd7-a6a7-c9d31d8279b3` / source `147f091`; earlier `119887c9-0516-401b-96b8-f857e95bd88c` / source `28b151b` remains available. Initial local checkpoint `6f4ec30` is preserved in Git history.

The final audit also migrated LAN **Cancel / delete** to the shared confirmation with an in-flight ref, pending label, Escape protection and inline retry. A new controlled-response browser regression requires Cancel to make no DELETE, failure to preserve the row/dialog, and acknowledgement before removal. All **nine desktop/LAN tests passed (24.8 seconds)**. Desktop web source/styles/build are updated; **the existing Windows EXE and ZIP were not rebuilt**. The original nine sharing regressions remain verified separately. Final frontend checks: 34 units, lint, TypeScript, desktop web build and guarded Pages build passed. Backend remains 92 passed / seven skips for unconfigured disposable services/coturn.

The LAN-only follow-up affects `main.tsx`, `style.css` and `e2e/desktop-product.spec.ts`. It does not enter the Online bundle: rebuilding and comparing actual deployed bytes confirmed the Online JavaScript and CSS are identical to source `7612991`; no redundant public deployment was performed. SHA-256: JS `97e7505e5161d81926595eff0ce1af65c919a4c4b8bb07f7530833dcaf81a1a3`, CSS `c7c659856cb6a56dd359cb9a7cb0686dfed1c5b78c821bdbb4cd65103578a7e9`.

Evidence: `.flowdrop/ui-consistency-public-final/.last-run.json` (passed, no failed tests), `.flowdrop/ui-consistency-pages-final.png` (actual provider success/source), `.flowdrop/ui-consistency-live-home.png`, `.flowdrop/ui-consistency-confirmation.png`, `.flowdrop/ui-consistency-loading-{light,dark}.png`, `.flowdrop/ui-consistency-lan-cancel.png`. Provider support reply status was not rechecked during this UI task; the actual public close-frame failure was reverified. Remaining physical/TURN/infrastructure/restart limitations above remain external release gates, so this is not a claim of production readiness.
