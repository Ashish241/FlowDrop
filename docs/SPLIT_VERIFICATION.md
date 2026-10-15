# 0.4.0 verification — SPLIT-20261015.1

Date: 2026-10-15. Starting source: `13ec1e7`. **IMPLEMENTED / LOCALLY TESTED; NOT DEPLOYED or INTERNET VERIFIED.** No public URLs exist for this checkpoint. No code was pushed, service publicly deployed, paid resource provisioned or release published.

## Result by target

| Target | Implemented | Local evidence | External gate |
|---|---|---|---|
| FlowDrop Desktop | Offline-only resources/navigation, source/frozen entry, existing LAN networking/pairing/transfers/resume/queues/security | Five independent desktop browser scenarios, physical-adapter unit tests, rebuilt executable smoke, native Tk QR/hash-matched LAN payload/socket/restart/shutdown and actual Windows TCP checks | No new phone, clean Windows, human GUI/UAC/firewall test |
| FlowDrop Online | Dedicated responsive home/send/receive/text/progress/diagnostics/help website, shared WebRTC transport, invitation/approval, supported folder-file picker | Three dedicated website scenarios: no local API dependency, five widths and automated accessibility; actual bidirectional/multiple files/text/cancel/reconnect; injected corrupted bytes fail hash and streaming download | Approved public HTTPS hosting and actual cross-network devices |
| Public signaling | Exact HTTPS origins, one-worker memory MVP, existing secure rooms/approval/expiry/socket/rates, optional Redis authority | Backend tests plus extracted source ZIP real-process HTTP/room/CORS/no-desktop smoke | Provider runtime, deployed WSS/CSP/origins, restart and client-rate identity acceptance |
| STUN/TURN | Direct-first STUN deployment configuration, short-lived authenticated coturn support and route/relay diagnostics retained | Existing implementation/test coverage; prior coturn forwarding error inspected in upstream source | No successful Internet or browser relay; prior WSL UDP forwarding failure unresolved |

## Actual tests

- Pytest: **74 passed, 6 skipped** (unconfigured provider integration cases). No provider rerun is claimed for this split; the six real Redis/PostgreSQL/S3/coturn tests passed at the preceding 0.3.2 checkpoint. The memory MVP requires none of those services.
- Vitest: **9 passed**.
- Preserved combined Playwright suite: **20 passed, 1 conditional relay case skipped**, 1.6 minutes. Includes two separate browser processes transferring a 16 MiB + 17 byte file. It is not Internet verification.
- Dedicated Online target: **3 passed**, 12.9 seconds. Transfers two selected files (2 MiB + 17 bytes and 131,089 bytes), a reverse file and text/URL; tests cancellation, refresh/reconnect and deliberate corruption. A stream download can begin before verification; on injected corruption its download fails and the UI never reports verified completion.
- Dedicated Desktop target: **5 passed**, 14.6 seconds. Four are repeated existing LAN scenarios against the new target, not additional unique product behavior.
- Ruff check/format, ESLint, strict TypeScript and all three Vite builds passed. Actual bundle inspection confirms no online/cloud implementation in desktop and no desktop/cloud API implementation in Online. Static website screenshot was inspected locally.
- Windows PyInstaller build, version/build/manifest hashes, bundled offline frontend/API and zero-code shutdown passed outside the checkout. Final extracted native diagnostic transfers a hash-matched 256 KiB file and authenticated socket echo between same-PC clients; QR, restart and shutdown pass. Actual socket records and final artifact SHA-256 are in `SPLIT_0.4.0_EVIDENCE.json`.
- Independent extracted signaling source artifact started a real loopback process, created a room with exact-origin CORS, refused an unauthorized origin and exposed no `/api/health`; no desktop/database was running for that smoke.
- CI commands were extended for separate builds/boundary/product tests, but remote CI was not run. Hosting configs were reviewed against current primary documentation, not deployed/provider-runtime validated. Docker engine/container execution remains unavailable/not run.

Initial product test failures were harness issues: an early empty room-code read, a missing local variable while fixing that race, and a hardcoded queue-test port. Those were corrected and the scenarios passed. The corruption assertion was corrected to check failed streaming completion rather than absence of a download-start event. An early baseline native run encountered Windows routing/profile inventory failure and safely refused auto-selection; subsequent authoritative inventory and new-build native LAN verification passed without changing adapter logic, profiles or firewall rules. Native DHCP notification testing remains explicitly mocked; sockets and payload checks are real local operations.

Expected warnings remain: Starlette/httpx TestClient deprecation, optional PyInstaller platform/import warnings, and Windows asyncio connection-reset messages during browser socket closure. The exercised transfer/API/Tk paths passed; warnings are not hidden or treated as physical acceptance.

## Artifacts and use

- `dist/FlowDrop-windows.zip` and `dist/FlowDrop-desktop-0.4.0/FlowDrop.exe`: offline desktop distribution. No online setting or Internet connection is required.
- `dist/FlowDrop-online-static.zip`: dedicated website assets, with same-origin `/signal` default. For separate Pages/Render hosting, rebuild with the actual authorized HTTPS signaling URL before uploading.
- `dist/FlowDrop-signaling-source.zip`: minimal standalone backend source/config/dependency artifact; no LAN/cloud service or persistent database required for memory mode.
- Preserved prior ZIP: `dist/checkpoints/FlowDrop-0.3.2-online-working.zip`, SHA-256 `A1D23B7BB38785F7302280AA00D1848C8439FCE73A76EFC2D681381BFD8E685F`. Previous 0.3.1 ZIP and working extractions remain intact.

See [product separation/build commands](PRODUCT_SEPARATION.md), [free hosting and authorization](FREE_HOSTING.md), [real Internet acceptance](INTERNET_ACCEPTANCE.md), and the machine-readable evidence for hashes/bindings. Historical 0.3.2 records retain their original scope and artifact identity.

## Remaining blockers

1. Explicit public deployment authorization and authorized hosting-account access; separately authorize any Git push. No actual website/signaling URL has been assigned.
2. Configure/rebuild with the real endpoint, deploy free static/signaling projects, then verify HTTPS/WSS/CORS/CSP, cold starts, restart expiry and provider client identity/rate behavior.
3. Actual broadband PC ↔ mobile-data phone transfer, QR scan, hash-checked saved files and large/mobile browser behavior, independently of a personal desktop host.
4. Reachable authenticated public TURN and successful relay-only browser transfer for restrictive networks. Direct-first MVP must continue to disclose failure limits.
5. New-build physical LAN and clean Windows acceptance, Docker/runtime/remote CI and independent production security/availability review.

The ultimate public-launch acceptance requirement is **not met** until deployment and a real cross-network transfer succeed. Local implementation and artifacts are ready for the next authorized step.

## Final artifact identity and sockets

- `C:\My Projects\flowdrop\dist\FlowDrop-windows.zip` (25303760 bytes), SHA-256 `998522DE5F60AB484096026F53BC99EBFBB516F094C8B241C2A6C337C5E5D0DC`.
- `C:\My Projects\flowdrop\dist\FlowDrop-online-static.zip` (103814 bytes), SHA-256 `87D70E209680D3EB5945D3ED6A69BD01B44575ECBABD2E6B024893A6433B80CD`.
- `C:\My Projects\flowdrop\dist\FlowDrop-signaling-source.zip` (14105 bytes), SHA-256 `B39F448D7E1B1E1A78609D6D1FCE39C44C24C07414A36CEDFDD70BC713813A73`.
- loopback: actual `127.0.0.1:4932`; frontend, health, Host/Origin and unauthorized WebSocket checks passed.
- lan-selected: actual `192.168.1.7:4948`; frontend, health, Host/Origin and unauthorized WebSocket checks passed.
- lan-all: actual `0.0.0.0:4956`; frontend, health, Host/Origin and unauthorized WebSocket checks passed.

The native LAN host also listened at `192.168.1.7:8000` and `127.0.0.1:8000`. Automatic Public-profile exposure was refused; explicit trusted-adapter selection was exercised. These are same-PC checks, not physical reachability.
