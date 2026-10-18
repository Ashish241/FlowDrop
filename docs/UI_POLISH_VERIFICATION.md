# Focused UI polish — 2026-10-18

## Changes

- `apps/web/src/online-style.css`: removed only the navbar bottom border; preserved component borders, theme background and responsive spacing. Added scoped dialog/chat styling.
- `apps/web/src/room-dashboard.tsx`: native invitation confirmation replaced with a centered HTML dialog (accessible title/description, native focus trap, Cancel initial focus, Escape, focus restoration). Pending ref and disabled buttons prevent duplicate rotation. Errors remain inline and retryable; success updates snapshot from the authenticated server response, refreshing code/link/QR/countdown without replacing membership or transfers.
- Chat uses content-width bubbles capped at 78%, outgoing/right and incoming/left; safe multiline text and wrapping are preserved. Composer is beneath history. Desktop Enter sends and Shift+Enter inserts a line break; mobile retains native newline behavior and explicit Send. IME composition does not trigger sending. Existing recipient selection, message IDs and actual receipts are unchanged. No fabricated timestamps or acknowledgements.
- `apps/web/src/optical.tsx`: Send via Screen / Receive via Camera landing cards become compact flow switches after selection. One selected flow is shown; both retain state. Display settings are collapsed. Sender keeps preparation estimates, QR playback, fullscreen, repeat and selective recovery. Receiver has permission recovery instructions, camera framing, live progress and incomplete/verified states. Changing flow stops the old camera stream; scanned data remains. Recovery-camera preview remains visible when used by the sender.
- Scoped Optical styles in `online-style.css` and `style.css` preserve desktop/LAN usage. No codec, decoder worker, WebRTC data protocol, backend authorization or Windows binary was replaced.

## Functional and visual verification

The full local browser suite includes direct DataChannel file bytes, multi-recipient delivery, pause/cancel/retry, reconnection, retained attachments, room host controls, text receipts and optical reconstruction. Expanded modal coverage checks Cancel/Escape, focus, centered geometry after entrance animation, injected HTTP failure, inline retry, disabled pending confirmation, exactly one successful rotation and retained lock/participants/unrelated file offer. Long Unicode/HTML-like text remains inert, multiline, delivered and contained at mobile width.

Optical layout checks cover 390 and 1280 pixel widths in light and dark themes, flow navigation, collapsed advanced controls, camera guidance, no horizontal overflow, axe accessibility and no recovery/download action before data/verification. Existing tests still cover denied permission, synthetic video reaching the actual worker, image imports, duplicate handling, retained chunks, missing-frame feedback, manual selective replay, parity reconstruction and hash verification.

The initial full browser run passed 21 scenarios but one geometry assertion sampled the 160 ms entrance animation. It was corrected to poll for settled centering with the same three-pixel tolerance; all five focused cases then passed. Final full-run results are appended below. An earlier interrupted run is not counted as a pass.

## 64 KiB reliability benchmark

Actual rendered sender QR images, not raw protocol injection: a seeded 65,536-byte binary fixture uses 400-byte data payloads, 164 data frames with parity deliberately disabled. The test withholds 28 frames (periodic loss plus a burst and final-frame loss), imports a duplicate without increasing progress, interrupts scanning, exchanges an actual reverse recovery QR, selectively retransmits only missing data, and compares the downloaded bytes and SHA-256 with the original. Network requests are forbidden after page/decoder load. The first complete run in this task passed in 58.0 seconds; that is automated image-import/browser test duration, not physical camera transfer time. Default parity-enabled sizing remains 164 data + 42 parity = 206 frames; at 1,000 ms/frame, a nominal cycle is 206 seconds, not a delivery guarantee. Prior raster accuracy/effective-payload measurements remain in `OPTICAL_BENCHMARK.json`.

No post-fix physical phone-camera or cross-network acceptance is claimed. The original real 328-frame/two-cycle failure is not dismissed: optical acceptance remains limited to the verified automated reconstruction/recovery paths.

## Production and rollback

No new frontend deployment is performed for this polish. The existing mandatory public close-frame gate remains unresolved: the deployed backend sends removal but public Python and Chromium observe 1006 instead of an actual 4003 frame. This UI task does not weaken that gate or conceal the failure. Website https://flowdrop-online.pages.dev/ remains source `8076ed5`, Pages `35f51697-1f2d-409f-86e7-10f3ff1010ba`; Render backend remains source `4257560`, deployment `dep-dba8nlgm7kps73ftjaog`. Prior working rollback is Pages `ec70164f-7da3-4e45-85b8-b16d90791fc5` and backend `dep-db96g8rl550s73ctk5dg`. Existing free services only; automatic deployments stay disabled.

Remaining gates: public close-frame diagnosis/correction, final hosted frontend/service suite, physical PC/phone cross-network tests, physical optical camera tests and TURN availability. Rooms remain single-instance memory and restart-sensitive. Windows EXE/ZIP remain preserved; desktop frontend regression does not imply a rebuilt executable. Online bundle size and pinned WebSocket transport deprecation remain documented advisories.

## Screenshots

Local browser captures (not phone photos): `.flowdrop/ui-polish-invitation.png`, `.flowdrop/ui-polish-mobile-chat.png`, `.flowdrop/ui-optical-send-light-1280.png`, `.flowdrop/ui-optical-receive-dark-390.png`, plus the light/dark sender/receiver variants at both widths. `.flowdrop/optical-64k-verified.png` shows actual automated completion.


## Final gates

- Complete final Online browser suite: **23 passed, 2.1 minutes**, `.flowdrop/ui-polish-verified`.
- Complete final desktop/LAN browser suite: **8 passed, 21.2 seconds**, `.flowdrop/ui-polish-desktop-final`.
- Frontend unit tests: **31 passed / 12 files**, 12.68 seconds.
- Backend: **87 passed, seven infrastructure skips**, 7.59 seconds; Ruff passed.
- ESLint, TypeScript, Online build, desktop frontend build and guarded Pages production build passed. Existing Vite >500 KB advisory remains (guarded JS 689.67 KB; gzip 270.89 KB).
- Final 64 KiB loss/recovery browser case: **46.8 seconds**, exact byte equality, SHA-256 equality, no network requests after decoder load.
- Final responsive screenshots visually reviewed: centered invitation error/retry dialog and contained mobile chat; light/dark Optical screenshots passed automated layout and axe checks.
- Windows ZIP SHA-256 unchanged: `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`.
- No hosted or physical result is inferred from these local passes. Public deployment remains withheld for the previously documented strict close-frame failure.
