# Optical and Windows preview verification — 2026-10-19

Status: Windows preview published and anonymously hash-verified; Online frontend deployed; final hosted acceptance and navigation follow-up pending. This is a preview, not a production-readiness claim.

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

Default remains conservative 400 B, Normal/Auto 1000 ms, two parity shards per eight data frames: 164 data +42 parity =206 frames, approximately 206 seconds per cycle before recovery. Slow 1400 ms and Fast 600 ms remain explicit options. Fewer QR frames do not establish a faster physical transfer; denser QR versions can decode worse. Existing degraded-raster benchmark limitations remain in [Optical reliability](OPTICAL_RELIABILITY.md).

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

Actual packaged executable smoke: loopback API/frontend and graceful exit from outside checkout passed. Packaged native widget lifecycle, adapter selection, pairing QR, authorization, real HTTP/WebSocket checks, restart and shutdown passed. Observed listeners: loopback-only `127.0.0.1:8000`; LAN enabled `192.168.1.7:8000` and `127.0.0.1:8000`. Approved 256 KiB hash-matched transfer through LAN URL passed using clients on the same PC. This does not verify phone reachability. Host’s Wi-Fi profile was Public; no firewall or profile changes were made.

Previous ZIP preserved under `dist/checkpoints/6ce485a-before-optical-release/`, hash `cf8e76e3d14fa88fa3d77f2629bbfce155e58a1c38f7ba05b7dbb1ebf5590e18`. Source checkpoint `6ce485a` remains in Git.

## Automated checks

- Backend 92 passed / 7 unconfigured infrastructure checks skipped; Ruff passed.
- Frontend 35 unit/benchmark tests passed; TypeScript, lint and Online/desktop builds passed.
- Online suite28/29 passed initially; the one outdated always-visible-help assertion was updated for required modal disclosure. Focused help/fullscreen 3 passed; decoder-stall recovery 1 passed; 64KiB real sender-QR recovery and synthetic-camera/FEC regressions passed.
- Desktop browser 9 passed. Full final Online/public suites and final general/Pages builds are recorded below after publication.

## External acceptance and blockers

Physical Optical: on 2026-10-20 the user replied “all working” to the public PC-screen → phone-camera short-text and 64 KiB acceptance request. This is user-reported success, not agent-observed verification. Phone/browser, cycle counts, recovery details and explicit final SHA-256 confirmation were not supplied. Physical LAN phone, cross-network PC/phone, TURN relay and clean Windows remain unverified. TURN is absent. Render Free rooms are in memory and lost on restart; no new paid/shared service is provisioned. Public server-initiated WebSocket close-frame delivery remains a separate Render support blocker; strict verification must not accept 1006/timeouts as 4003. Existing explicit terminal events are verified independently.

## Physical acceptance procedure

1. Open the corrected public Optical page on PC and phone, wait for Decoder ready, and confirm the new Exit Fullscreen control exists.
2. Transfer short text, then a small binary file. Compare name, size and SHA-256.
3. Transfer a deterministic 64 KiB file with Normal 400 B/default parity. Record phone model/browser, unique received/missing counts after each cycle, glare/distance, total elapsed and final hash.
4. Stop/restart scanning mid-transfer; confirm counts persist. Use Recover Missing Frames and let the PC camera scan all recovery pages, or enter missing numbers manually. Confirm only missing chunks resend and final download verifies.
5. For LAN, use a trusted Private network and appropriate local-subnet firewall allowance. Launch extracted Windows preview, enable LAN, confirm physical adapter and Start; open actual LAN URL/QR on the phone, request approval, then offer/accept files both directions. Record final hashes and shutdown.

Never report these physical checks as passed without the user’s actual results.

## Published Windows preview

[Release notes](https://github.com/Ashish241/FlowDrop/releases/tag/v0.4.2-preview.1) · [Verified portable ZIP](https://github.com/Ashish241/FlowDrop/releases/download/v0.4.2-preview.1/FlowDrop-windows.zip)

Source checkpoint `6905d40`. Anonymous HTTP download returned exactly 25,389,518 bytes and matched the ZIP SHA-256 above. GitHub asset digest matches too. The website download page labels architecture/version/size, portable extraction, unsigned preview, checksum and physical-test limitations. No standalone EXE asset is offered because this onedir build requires its bundled runtime directory.

Final local Online suite: 32 passed, including the new watchdog/fullscreen and Windows download coverage; final full-width assertion and download accessibility follow-up: 2 passed. Integrated regression suite: 20 passed / 1 optional coturn relay test skipped. Desktop browser: 9 passed. The final additional three-peer host-ending scenario revealed and corrected duplicate red terminal alerts and stale terminal state hiding invalid new-room feedback. The final complete run passed all 32 cases.

![Optical sender](screenshots/optical-send-light.png)
![Windows preview](screenshots/windows-preview-light.png)

Three-peer host-end and chat follow-up: 2 passed. Both terminal actions, stale-code rejection, pending-offer removal, session cleanup and absence of red terminal alerts were verified.

Final local release gates: 32 Online browser cases passed (2.3m), frontend lint/TypeScript passed, public v2 signaling health returned 200. Pages build/public deployment acceptance follow below. The published EXE PE machine is AMD64 (`0x8664`), independently inspected.

## Public deployment

Online source `79535bce8c6541df8e95be65a15bd84a6142f706` was manually deployed to the existing Pages Free project: `6f32c2ba-4560-4736-9db9-9e752e40b397`, success in 32 seconds. Public metadata identifies that exact source; JavaScript, CSS and worker SHA-256 values match the locally verified Pages build. HTTPS/CSP/WSS endpoint configuration passed. Automatic deployments remain paused; Render was not redeployed because the backend room-ended event was already implemented and healthy.

Website: https://flowdrop-online.pages.dev/ · Windows page: https://flowdrop-online.pages.dev/#/windows · Signaling: https://flowdrop-signaling.onrender.com/signal

The unchanged strict public verifier still fails with `AssertionError: Public transport ended without a close frame`. Log: `.flowdrop/optical-public-strict-close.log`. No result has been reclassified as a successful 4003 close. This remains an external Render gate even when explicit terminal events and browser UI acceptance pass.

Manual public inspection found route navigation retaining the prior scroll offset. A one-line Online route scroll reset and two focused passing navigation tests correct this; final source/deployment and hosted result follow below. It does not change Optical decoding, Online transport or the published Windows artifact.

Initial hosted run: 29 passed / 2 failed / 1 expected clock-control skip. The Windows test included the new scroll assertion before the scroll fix was deployed. The termination test attempted Send while another selected peer was still reconnecting; the application correctly refused the send. Its setup now explicitly waits for both intended channels to be open and both recipients selected. The corrected test then passed against the real public service (14.7 seconds), including host termination of both guests. Final complete hosted acceptance follows after the navigation deployment.

All 10 desktop frontend files match the bundled published package byte-for-byte. The Windows release remains unchanged throughout Online-only follow-up work.

Navigation follow-up source: `e17ca4797c77efeb5f62d831dc778a0d98a0617a`. Locally verified route scroll reset and unchanged canonical navigation: 2 passed. Final Pages build completed with the validated HTTPS/WSS signaling endpoint and no localhost URLs. Final successful deployment (43 seconds): `8ef3e6b2-6718-43de-86f7-759fbf936a54`.

## Final acceptance, 2026-10-20

The public website runs source `e17ca47`, Pages deployment `8ef3e6b2-6718-43de-86f7-759fbf936a54`. Public HTTPS, exact metadata/source and JavaScript/CSS/decoder-worker hashes match the verified build. Automatic deployments remain paused. Windows preview source `6905d40` and its published ZIP remain unchanged.

Final hosted full run: **30 passed, one test-fixture race failed, one expected clock-control skip**. The recovery fixture accessed a joining peer's socket before initialization. It now waits for both actual open signaling sockets and peer connections while still asserting neither DataChannel is connected. The corrected public recovery case passed **three of three repeated runs**. All 31 runnable hosted scenarios have coverage across these runs; this is not a single clean full-suite run. No application change or new deployment was needed for the fixture correction.

The user reported “all working” for the requested public Optical PC-screen → phone-camera short-text and 64 KiB tests. Record this as user-reported physical acceptance only. Model/browser, received/missing counts, recovery outcome details and explicit final hash confirmation were not reported. The fixture is `.flowdrop/optical-64k-regression.bin`; its independently computed expected SHA-256 is `fd3623ef92dc587838fcebecdfd88e5288178c52a0b905294d8d0ee9ef0d2634`.

The unchanged strict Render close-frame gate still fails; TURN is absent, rooms use volatile single-instance memory, and physical LAN-phone, cross-network WebRTC, packaged-Windows camera and clean-PC acceptance remain unverified. This preview is not a claim that all production release gates passed. Machine-readable results: [OPTICAL_WINDOWS_VERIFICATION.json](OPTICAL_WINDOWS_VERIFICATION.json). Earlier dated entries above retain the verification history.
