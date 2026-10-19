# Optical and Windows preview verification — 2026-10-19

Status: implementation and local verification complete; publication/public acceptance pending. This is a preview, not a production-readiness claim.

## Optical investigation

The reported 328 frames match the legacy 200-byte 64 KiB format. Repeating a fixed sequence twice does not guarantee new acquisition: fixed-phase camera sampling can miss the same frames on both cycles. The prior source already introduced compact v3 Base45 encoding, CRC, SHA-256, optional Reed–Solomon parity, bounded beneficial compression and offline selective QR/manual recovery. The original physical capture/counters are unavailable, so the precise camera-specific failure is not established. The previously preserved Windows package predates this release’s compiled interface.

This update fixes the confirmed one-way fullscreen button, adds a bounded decoder watchdog/restart that preserves collected chunks, ignores queued acquisition after verified completion, and shows a no-new-frame hint after 15 seconds. Decoder timeout is 10 seconds; recovery QR rendering failures are actionable. Camera Stop/Start and repeated cycles retain chunks; only Reset discards them. Receiver counts come from decoded unique data frames, not sender animation.

## 64 KiB benchmark

Synthetic 600px QR raster acquisition, deliberate loss, reverse order, duplicates, QR recovery, byte equality and final SHA-256. Timings exclude physical camera acquisition and animation dwell. No parity/compression in this comparison:

| Payload | Data frames | Decode attempts including duplicates/recovery | Recovered missing frames | Processing seconds |
| --- | ---: | ---: | ---: | ---: |
| 200 B | 328 | 343 | 47 | 9.075 |
| 400 B | 164 | 171 | 24 | 5.255 |
| 600 B | 110 | 115 | 16 | 4.324 |
| 800 B | 82 | 86 | 12 | 6.299 |

All reconstructed hashes: `fd3623ef92dc587838fcebecdfd88e5288178c52a0b905294d8d0ee9ef0d2634`.

Default remains conservative 400 B, Normal/Auto 1000 ms, two parity shards per eight data frames: 164 data +42 parity =206 frames, approximately206 seconds per cycle before recovery. Slow1400ms and Fast600ms remain explicit options. Fewer QR frames do not establish a faster physical transfer; denser QR versions can decode worse. Existing degraded-raster benchmark limitations remain in [Optical reliability](OPTICAL_RELIABILITY.md).

## Interface and lifecycle

- Shared QRFrameViewer uses actual `fullscreenchange`/`fullscreenElement`, guarded requests, visible Exit Fullscreen, Escape synchronization and an accessible expanded fallback without remounting QR state.
- Full-width Optical content/camera and control/progress columns stack on mobile. Instructions are in a centered reusable informational modal.
- Existing authenticated host `ended` event invalidates rooms/codes before asynchronous notification. Participants receive “This room has ended” and “The room host has ended the sharing session.” Return to Home/Join Another Room clean terminal state. Recovery 403/404 uses accurate generic expired/ended text; a temporary disconnect alone does not imply host termination.
- Native Windows panel starts stopped with LAN disabled, shares FlowDrop branding and light/dark colors, and keeps diagnostics secondary. Its browser dashboard retains LAN controls, selection/approval, queues and Optical Share.

## Windows package

Version `0.4.2-preview.1`, build `OPTICAL-20261019.1`, Windows x64 portable ZIP. Extract all files; `FlowDrop.exe` requires `_internal`. Unsigned; clean-PC acceptance is unverified.

ZIP size: 25389518 bytes. ZIP SHA-256: `674c7109ad2e265e3c6106742cc9f53c0455f1b37bcb53fe57818e4c7258c70e`.

EXE SHA-256: `8314b6dffec759eae12bb374711c4a07f69c4d9d5230b6c7e42a29cc30bc776d`.

Package audit: 1,732 entries; EXE and Optical worker present; no `.env`, secret-config or saved network-preference filenames bundled. Runtime service secrets are not packaging inputs.

Actual packaged executable smoke: loopback API/frontend and graceful exit from outside checkout passed. Packaged native widget lifecycle, adapter selection, pairing QR, authorization, real HTTP/WebSocket checks, restart and shutdown passed. Observed listeners: loopback-only `127.0.0.1:8000`; LAN enabled `192.168.1.7:8000` and `127.0.0.1:8000`. Approved256KiB hash-matched transfer through LAN URL passed using clients on the same PC. This does not verify phone reachability. Host’s Wi-Fi profile was Public; no firewall or profile changes were made.

Previous ZIP preserved under `dist/checkpoints/6ce485a-before-optical-release/`, hash `cf8e76e3d14fa88fa3d77f2629bbfce155e58a1c38f7ba05b7dbb1ebf5590e18`. Source checkpoint `6ce485a` remains in Git.

## Automated checks

- Backend92passed /7unconfigured infrastructure checks skipped; Ruff passed.
- Frontend35unit/benchmark tests passed; TypeScript, lint and Online/desktop builds passed.
- Online suite28/29passed initially; the one outdated always-visible-help assertion was updated for required modal disclosure. Focused help/fullscreen3passed; decoder-stall recovery1passed; 64KiB real sender-QR recovery and synthetic-camera/FEC regressions passed.
- Desktop browser9passed. Full final Online/public suites and final general/Pages builds are recorded below after publication.

## External acceptance and blockers

Physical camera: user has offered PC screen/phone camera testing; corrected-build result pending. Physical LAN phone, cross-network PC/phone, TURN relay and clean Windows remain unverified. TURN is absent. Render Free rooms are in memory and lost on restart; no new paid/shared service is provisioned. Public server-initiated WebSocket close-frame delivery remains a separate Render support blocker; strict verification must not accept1006/timeouts as4003. Existing explicit terminal events are verified independently.

## Physical acceptance procedure

1. Open the corrected public Optical page on PC and phone, wait for Decoder ready, and confirm the new Exit Fullscreen control exists.
2. Transfer short text, then a small binary file. Compare name, size and SHA-256.
3. Transfer a deterministic64KiB file with Normal400B/default parity. Record phone model/browser, unique received/missing counts after each cycle, glare/distance, total elapsed and final hash.
4. Stop/restart scanning mid-transfer; confirm counts persist. Use Recover Missing Frames and let the PC camera scan all recovery pages, or enter missing numbers manually. Confirm only missing chunks resend and final download verifies.
5. For LAN, use a trusted Private network and appropriate local-subnet firewall allowance. Launch extracted Windows preview, enable LAN, confirm physical adapter and Start; open actual LAN URL/QR on the phone, request approval, then offer/accept files both directions. Record final hashes and shutdown.

Never report these physical checks as passed without the user’s actual results.
