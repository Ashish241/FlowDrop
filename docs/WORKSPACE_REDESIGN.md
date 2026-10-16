# Online workspace redesign — 2026-10-16

## Scope and root causes

This update extends the existing Online application and transport engine. The desktop LAN entry point and packaged Windows release are preserved.

The Online entry previously imported the legacy global stylesheet, used a centered consumer card, and mounted technical transfer UI inside each peer. File picker changes replaced the selection; navigation was held in component state; an invitation expiring after ten minutes could not be renewed. These were separate from WebRTC byte transport. A transient socket loss could also discard recipient selection or leave a closed peer transport cached.

The Online entry now owns its stylesheet and canonical hash routes. A single mounted room controller owns the attachment File references and selected member IDs while the user visits Home/Optical or reconnects. Each peer reuses the existing transfer engine through a compact room-only view. Closed transports can be recreated without clearing the composer. Explicit departure clears files and text history.

## User-visible behavior

- Exactly four homepage cards: Create Room, Join Room, Optical Share, Send Later—Coming Soon. Room pages omit homepage menus and legacy diagnostics.
- Fluid desktop workspace, approximately 65/35 columns; at mobile widths room information, devices, composer, transfers and text stack in order. QR invitations are collapsed by default.
- Files can be added by picker, folder selection or drop. Add preserves existing references; name/relative path, size, modification time and MIME type identify duplicates. Remove and Clear are explicit. Decimal sizes use 1 KB = 1000 bytes.
- Send checks files, recipients, membership and ready channels, with visible messages and recipient highlighting. Preparing, approval, sending, verification, completion, decline and cancellation are distinct. Existing acceptance, independent recipient transfers, pause/resume, cancellation and SHA-256 completion guards remain.
- Room code rotation is issued atomically by the single backend event loop every 600 seconds, broadcast to members, and invalidates the previous code. Stable room/member IDs, locks and WebRTC channels survive rotation. Code/QR update together.
- Authenticated 25-second client pings and server pongs maintain active rooms. Idle lifetime is one hour, capped at 24 hours. Background suspension does not immediately trigger a false heartbeat timeout. Invitation lifetime is separate from room lifetime.
- Join QR scanning starts only on user action, uses the actual jsQR decoder and validates a same-origin root invitation. Device name is required. Duplicate detections cannot create repeated joins; denial, unavailable camera and invalid QR retain manual input.
- In-page navigation and reconnect retain selected File objects. Full reload cannot restore browser File references: users must select the files again. Membership can resume from session storage while the backend room exists.

## Security and hosting boundaries

No new services, accounts, billing, secrets or dependencies were added. Existing origin checks, membership tokens, bounded rooms/members/messages, request limits, WebSocket authentication, recipient addressing and receiver approval remain. Room tokens are excluded from URLs and public rosters. Text is rendered as text. The test clock endpoint exists only in the disposable product test host, never the deployed signaling app. Production builds require the public HTTPS signaling URL and emit restricted HTTPS/WSS CSP origins.

The user selected existing free hosting only. V2 rooms and rate counters remain single-instance memory on the existing one-worker Render Free service. Provider sleep/restart/deployment can erase rooms; multiple backend instances do not share room state. This release does not claim restart persistence or distributed consistency. Cloudflare/Render automatic deployments remain disabled; deployment is manual.

## Verification

Local backend: 84 passed, 7 unconfigured provider tests skipped; rotation tests separately passed. Frontend unit: 17 passed. ESLint, Ruff, strict TypeScript and builds passed. Desktop browser suite: 8 passed. Vite room suite: 3 passed. Production Online: 11 passed, including home/workspace axe checks. Preserved combined regression: 20 passed, 1 conditional TURN test skipped. Public verification and deployment evidence are recorded below as completed.

Tests use actual Chromium DataChannels and compare received bytes, including multiple peers, receiver decline, batch isolation, pause/rename/rotation/resume, cancellation, reconnect and Unicode text. Six widths (360, 390, 768, 1024, 1440, 1920) check overflow, column ratio and mobile ordering. Home/workspace axe checks and screenshot review cover the new interface. Clock-controlled rotation tests preserve an outstanding offer and an active paused byte transfer.

Camera browser tests feed synthetic video frames through the real QR decoder; they are not physical camera tests. Public browser peers run on the same PC; they do not establish different-network connectivity. TURN relay, physical phone transfers/scanning, mobile background suspension and clean-device acceptance remain external gates.

## Preserved artifact

`dist/FlowDrop-windows.zip` SHA-256 remains `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`. Windows binaries were not rebuilt or replaced.

## Release evidence

Deployment pending final verification. Previous working checkpoint: `1587f9fb4039a3e3f5ec31eb59b5276e115bf25f`; previous public frontend `06d2c48`, backend `5859e74` remain rollback references. See `WORKSPACE_VERIFICATION.json` for final results and deployment identities.
