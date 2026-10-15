# Integrated 0.4.0 verification — INTEGRATED-20261016.1

Date: 2026-10-16 (Asia/Calcutta). Starting commit: `b1a3ec2`. **IMPLEMENTED / LOCALLY TESTED; NOT PUBLICLY DEPLOYED or INTERNET VERIFIED.** The previous split ZIP is preserved at `dist/checkpoints/FlowDrop-0.4.0-split-working.zip`; earlier working 0.3.1/0.3.2 archives and extractions remain intact.

## Delivered behavior

- Desktop retains its offline host-mediated LAN engine, physical-adapter selection, pairing/approval, dual listeners, streaming/resume/queues, text and firewall diagnostics. It now exposes Optical Share and a visible Send Later — Coming Soon screen. Online/cloud controls and implementation remain out of its shipped resources. File type is displayed honestly from the filename. Fully uploaded bytes no longer display 100% before the separate hash/finish step.
- Online Web retains WebRTC streaming/backpressure/hash/acceptance/cancel/reconnect and folder-file selection. New six-digit codes expire in 10 minutes and resolve to the existing strong room ID; short codes do not replace owner approval or participant capabilities. Both memory and Redis implementations support them, with atomic Redis allocation, TTL and safe code reuse/revocation. Pending receivers cannot obtain TURN credentials before approval.
- Cooperative in-session pause/resume gates outgoing chunks. Up to the bounded in-flight window may settle; resume on the device that paused. Refresh/disconnect still requires whole-file resend rather than arbitrary byte-offset resume. Metadata, direction, acknowledged progress, measured rate/ETA, safe text copy/clear and tab/session history are shown. Receiver hash verification gates 100%; browser download handoff is not verified disk saving.
- Both products include optical text (16 KiB) and binary files (64 KiB), animated QR control/speed, camera scan and image-import fallback, missing/duplicate/out-of-order tracking, bounded metadata/chunks, binary reconstruction and SHA-256 verification. Existing version-1 text frames remain compatible. [Optical guide](OPTICAL_SHARING_GUIDE.md) describes secure contexts and limitations.
- Send Later has no upload UI/API calls in shipping products. Public Nginx `/cloud/` returns 404; standalone signaling exposes no cloud routes. Legacy source and the explicitly local combined regression fixture remain for preservation/testing. No cloud storage/database/payment service was added or deployed.

## Actual verification

| Check | Result | Scope |
|---|---|---|
| Before-change baseline | 74 backend, 9 unit, 8 product browser tests passed | Existing working checkpoint; an occupied owned preview port was stopped before the baseline browser rerun |
| Final backend | 77 passed, 7 provider integration cases skipped when unconfigured | Includes short-code expiry/revocation/rate limits and withholding TURN credentials from pending receivers |
| Real Redis integration | 4 passed, other provider cases deselected | Two instances, code join/approval/routing/revocation, collision, TTL expiry, safe reuse and pending TURN denial. Temporary loopback fixture only |
| Frontend unit | 11 passed | Real QR raster decode, 64 KiB binary reconstruction with loss/reorder/duplicates, malformed/unsafe metadata/size/checksum rejection, existing hash/crypto/queue tests |
| Product browser suite | 13 passed (35.3s) | Both products: actual QR PNG reconstruction with browser networking disabled, sender controls, simulated camera denial, Coming Soon/no cloud calls; online six-digit join, actual bidirectional/multiple files, pause/resume, text/clipboard/clear, cancel/reconnect/corruption; LAN regression and pre-verification progress |
| Combined browser regression | 20 passed, 1 conditional positive relay skipped (1.4 min) | Preserved local LAN/WebRTC/legacy cloud/optical/worker/responsive/accessibility suite, including two browser processes and real saved-byte comparison |
| Static and builds | Passed | Ruff check/format, ESLint, strict TypeScript, separate desktop/online and legacy Vite production builds, actual distribution-boundary checks; website screenshot inspected |
| Windows artifacts | Passed | Rebuilt frozen executable/ZIP, version/build/manifest hashes, offline frontend/API/zero-exit smoke; exact extracted native Tk/QR/256 KiB hash-matched LAN file/socket/restart and actual listening sockets |
| Signaling artifact | Passed | Extracted backend ZIP real-process HTTP/short-code joining; desktop/cloud routes absent. No hosted service inference |

Some browser cases repeat established LAN scenarios against the product build; do not add the counts as unique product capabilities. Test-harness issues (ambiguous duplicate heading and an unused local variable) and lint-invalid control-regex syntax were corrected; the safe filename sanitizer now checks character codes directly. Initial approval-review usage exhaustion prevented one verification command from executing; it later succeeded through normal review without bypassing permissions.

Expected warnings: Starlette/httpx TestClient deprecation, optional PyInstaller module/platform warnings, Windows asyncio connection-reset messages when browsers close sockets, and the disposable WSL Redis memory-overcommit warning. No host sysctl/profile/firewall settings were changed to suppress them. The fixture uses no persistence and was stopped after its tests.

## Physical and infrastructure boundaries

Actual QR images and binary data were decoded locally. Camera-denial tests replace the browser camera API; they are not camera hardware tests. No new physical phone, real screen-to-camera scan, clean Windows, human GUI/UAC/firewall, disconnected LAN or different-Internet-network acceptance was performed. The user's earlier physical LAN success remains baseline evidence only.

Public deployment still needs explicit authorization and authorized hosting-account access. No public website/signaling URL is assigned. Current Pages/Render/STUN limits and WebSocket support were rechecked against provider documentation (links in FREE_HOSTING.md). Render free sleep/restart and quota/billing limitations remain; ephemeral rooms are lost on restart. There is no configured successful public TURN relay. The previous WSL coturn forwarding `Operation not permitted` remains unresolved, and its positive browser relay case is not reported as passed. PostgreSQL/S3/coturn service tests, Docker runtime, remote CI and public proxy/TLS were not rerun for this iteration.

The source is a locally verified engineering checkpoint, not a claim of production security, universal NAT traversal or public launch success. See [hosting setup](FREE_HOSTING.md), [actual Internet checklist](INTERNET_ACCEPTANCE.md) and machine-readable `INTEGRATED_0.4.0_EVIDENCE.json` for artifacts, hashes, rollback and exact sockets.

## Final artifacts and listening addresses

- `C:\My Projects\flowdrop\dist\FlowDrop-windows.zip` (25306929 bytes), SHA-256 `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`.
- `C:\My Projects\flowdrop\dist\FlowDrop-online-static.zip` (157088 bytes), SHA-256 `7354E54A38755B902966AF87D19803710E767EBF2FE7A74A0D597CB00E15CAFA`.
- `C:\My Projects\flowdrop\dist\FlowDrop-signaling-source.zip` (14742 bytes), SHA-256 `1091F34AA2BAFF19F0E09A6DB64129B5A85B694F9EE3D9B3282A1BB67B03FD13`.
- Exact extracted executable: `C:\My Projects\flowdrop\dist\FlowDrop-integrated-0.4.0\FlowDrop.exe`; build/version and manifest hashes verified.
- loopback: `127.0.0.1:12981`, frontend/HTTP/Host/Origin/WebSocket authorization checks passed.
- lan-selected: `192.168.1.7:2945`, frontend/HTTP/Host/Origin/WebSocket authorization checks passed.
- lan-all: `0.0.0.0:5408`, frontend/HTTP/Host/Origin/WebSocket authorization checks passed.

Native panel also tested `192.168.1.7:8000` plus loopback `127.0.0.1:8000`; automatic Public-profile LAN exposure was refused. No firewall or network profile was changed.

## Changed files

- `CHANGELOG.md`
- `README.md`
- `apps/web/e2e/desktop-product.spec.ts`
- `apps/web/e2e/integration-product.spec.ts`
- `apps/web/e2e/online-product.spec.ts`
- `apps/web/playwright.products.config.ts`
- `apps/web/src/coming-soon.tsx`
- `apps/web/src/main.tsx`
- `apps/web/src/mode-cards.tsx`
- `apps/web/src/online-main.tsx`
- `apps/web/src/online-style.css`
- `apps/web/src/online.tsx`
- `apps/web/src/optical-file.test.ts`
- `apps/web/src/optical-protocol.ts`
- `apps/web/src/optical.tsx`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/FREE_HOSTING.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/INTEGRATED_0.4.0_EVIDENCE.json`
- `docs/INTEGRATED_VERIFICATION.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/OFFLINE_LAN_GUIDE.md`
- `docs/ONLINE_SHARING_GUIDE.md`
- `docs/OPTICAL_SHARING_GUIDE.md`
- `docs/RELEASE_READINESS.md`
- `docs/ROLLBACK.md`
- `docs/TEST_REPORT.md`
- `infrastructure/deployment/nginx.conf`
- `scripts/smoke-desktop.ps1`
- `services/signaling/app.py`
- `services/signaling/distributed.py`
- `services/version.py`
- `tests/integration/test_services.py`
- `tests/test_online_pairing.py`
