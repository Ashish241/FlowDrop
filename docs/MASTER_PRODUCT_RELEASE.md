# FlowDrop product integration — 2026-10-18

## Safeguard and audit

Starting checkpoint: `7aaf187` (clean tree). Previous public frontend source: `ccc356c`, Pages deployment `ec70164f-7da3-4e45-85b8-b16d90791fc5`. Previous Render source: `236535d`, deployment `dep-db96g8rl550s73ctk5dg`. These remain rollback checkpoints. Existing Windows executable/ZIP are preserved; this release does not rebuild Windows binaries.

The Online product has one entry (`online-main.tsx`) and canonical hash navigation. `room-dashboard.tsx` owns retained File objects and stable member selections; per-peer `online.tsx` handles actual DataChannel offers, approval, bytes and verification. `room-delivery.ts` tracks independent recipient attempts and avoids resending verified copies. Named rooms in `services/signaling/rooms.py` use hashed membership credentials, one worker and bounded in-memory state. Legacy signaling/LAN implementations are independent. There is no new service, storage system or paid dependency.

Already working at baseline: mandatory names, six-digit/QR auto joining without host approval, server-authoritative ten-minute rotation, lock, self-rename, mesh sharing, recipient snapshots, attachment recovery during in-page reconnect, pause/cancel/retry, SHA-256 completion, optical v3 recovery/FEC and disabled Send Later. These are retained and regression-tested rather than replaced.

## New functional work and confirmed causes

- Host-only authenticated manual invitation refresh reuses atomic collision-checked rotation. Old invitations become invalid; expiry resets; room/member IDs, lock and live transfers remain unchanged. Client confirmation, pending guard and server rate limit protect the operation.
- Host-only removal revokes membership before yielding, closes the socket with a terminal removal code, invalidates reconnect credentials and broadcasts a roster without the member. Other peers tear down only that member's transport; pending recipient deliveries fail independently. Self-removal and guest administration are denied. An anonymous device may rejoin with a new identity and valid invitation; this is not a permanent ban.
- A reproduced reconnect race affected the higher-ID peer if signaling dropped before a DataChannel opened: it discarded its unfinished connection, but the lower-ID offer initiator retained its stale negotiation. Recovery now tells both ends to reset unfinished negotiations; stable IDs still choose one initiator. One offer is allowed per peer object; stale offer completion and ICE callbacks cannot publish discarded negotiations or destroy replacement peers. Open channels survive signaling recovery.
- Text sends carry random message IDs and receive explicit DataChannel acknowledgements. Outgoing bubbles show actual acknowledged recipient counts. Unknown/duplicate receipts cannot fabricate a different message's delivery. Receipt means remote receipt, not that a person read it.
- Back to Home hides the workspace while keeping room/composer mounted. Explicit Leave/End warns when unresolved transfers exist. Leaving clears stale invitation input and temporary UI; removed/closed sessions show a calm terminal screen without automatic reconnect.

## Visual and navigation work

Custom SVG drop/transfer mark, light/dark variants and Online favicon; consistent four-card appearance; off-white/navy/teal tokens; integrated navbar; polished dark surfaces; outgoing/right and incoming/left chat bubbles; room-specific back control; host device menus; informational terminal states; five-second accessible toasts with cleanup; lightweight recovery animation; reduced-motion support.

The theme initializes before React from explicit local preference or system color scheme. With no override, system changes apply live. Explicit choices survive reload. Route titles cover home/create/join/room/optical/reconnecting. The existing full-width 65/35 desktop and ordered mobile workspace is preserved. Public Online navigation contains no Settings/SDP/ICE diagnostics; developer instrumentation remains internal. Optical density controls remain scoped to Optical Share.

## Optical and physical acceptance

The prior exact 64 KiB regression remains: legacy 328 data frames versus the current default 164 data + 42 parity = 206. A default cycle estimates 206 seconds; reduced frame count is not a physical speed claim. The maintained bounded erasure codec, explicit missing-frame QR/manual recovery, worker decoder and SHA-256 gate are preserved. See `OPTICAL_RELIABILITY.md`, `OPTICAL_BENCHMARK.json` and final verification evidence for actual loss/raster results. Larger transfers are directed to LAN/Online.

No post-fix physical camera or separate-network transfer is claimed. Tests on this PC use real browser DataChannels and exact downloaded bytes, synthetic camera video and actual QR image decoding. Physical PC/phone and TURN acceptance remain external gates. The original failing physical file/camera captures are unavailable.

## Verification and deployment

Local final gates: backend 86 passed/7 provider skips, frontend units 31 passed, complete Online browser suite 21 passed, desktop browser 8 passed, dark-theme axe and seven responsive widths passed. ESLint, Ruff, TypeScript, Online/desktop frontend and guarded Pages builds passed. Actual final results and hosting identities are recorded in `MASTER_PRODUCT_VERIFICATION.json`. Intermediate failures are retained there; aborted or sandbox-blocked runs are not called passes. All backend/frontend/browser/lint/build gates must pass before manual deployment. Existing Free projects and paused automatic deployment behavior are preserved.

Measured pre-release public health requests: 1.075 s and 0.396 s from this PC. These are health latency samples, not a cold-start guarantee or room-creation timings. Free-provider cold starts remain possible; the UI uses bounded recovery and no fabricated progress steps.

## Remaining limits

- Render rooms are single-instance memory and disappear on provider restart; no shared Redis or paid service is introduced.
- TURN is unconfigured. Restrictive networks may fail; no universal Internet connectivity claim.
- Browser restart cannot restore File objects without reselection/permission; in-page reconnect retains them.
- Browser/device capabilities limit very large file delivery despite the existing 20 GiB UI limit; a verified transfer does not universally prove disk persistence.
- Optical 64 KiB maximum, finite parity capacity and explicit recovery remain. Physical phone-camera reliability is unverified.
- The approximately 683 KB minified Online chunk still exceeds Vite's 500 KB advisory; this is documented, not suppressed.
