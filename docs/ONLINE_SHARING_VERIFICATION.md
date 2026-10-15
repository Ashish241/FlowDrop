# Online Sharing verification — 0.3.2 / ONLINE-20261015.1

Date: 2026-10-15. Starting source checkpoint: `febcc95`. This is an implemented and locally tested engineering checkpoint, **not an Internet-verified release candidate**. No public deployment, push, publication or paid provisioning occurred.

## Root cause

The packaged launcher serves the LAN FastAPI application only. It does not mount `/signal`. The previous online client defaulted to a relative `/signal`, so a packaged desktop user tried the loopback/LAN server and received 404. Development/browser-test hosts mount signaling, which masked that mismatch. No public HTTPS site/WSS endpoint, live TURN credentials or owned deployment domain was supplied. There is no evidence that the current working 0.3.1 frontend was stale.

Local room creation, SDP/ICE exchange and DataChannel opening are demonstrated by actual loopback transfers; there is no running public signaling service in this environment. Hosted WebSocket URLs derive from the page protocol (`wss:` for HTTPS, `ws:` for explicit loopback HTTP). Public HTTPS secure context is required; LAN HTTP cannot stand in for a public site. Missing STUN/TURN is explicitly reported rather than treated as guaranteed connectivity. No blanket Host, CORS, CSP or firewall bypass was applied.

The fix explicitly configures and health-checks a hosted online service, then opens its HTTPS frontend in a new tab. Hosted RPC/WSS stays same-origin. LAN tokens remain local, the original CSP/CORS restrictions remain, and unavailable online infrastructure cannot masquerade as a working room. The public edge overlay and shared STUN/TURN configuration make the deployment concrete without provisioning it.

## Status matrix

| Area | Status | Evidence and boundary |
|---|---|---|
| Desktop configuration, explicit unavailable/error state, host-only settings | IMPLEMENTED / LOCALLY TESTED | Backend access/validation/cache tests; browser gate; exact packaged executable handoff to a loopback development service |
| Room invitation link/QR, join, approval and authorization | IMPLEMENTED / LOCALLY TESTED | Browser approval and generated invitation; room ID never substitutes for participant capability |
| SDP/ICE/WSS protocol, DataChannel files/text/URLs | IMPLEMENTED / LOCALLY TESTED | Two separate Chromium processes, actual 16 MiB + 17 byte file download and byte comparison, URL sharing; existing reverse-direction 131,089-byte file test |
| Queue, backpressure, SHA verification, cancel, reconnect/resend, recovery, cleanup | PRESERVED / LOCALLY TESTED | Existing browser and backend regressions; interrupted WebRTC files restart rather than offset-resume |
| Redis rooms/expiry/revocation/rates, PostgreSQL/S3 | IMPLEMENTED / LOCALLY TESTED | Six real disposable-provider integration tests; no container or production HA claim |
| Multi-URL UDP/TCP/TLS TURN, short credentials, relay-only and selected-route display | IMPLEMENTED / PARTIALLY LOCALLY TESTED | Credential/HMAC/expiry/configuration tests and real coturn allocation/ACL checks; actual browser relay fails in local fixture, see below |
| Public HTTPS edge/WSS proxy/client identity | IMPLEMENTED / SYNTAX TESTED | Compose overlay parses; Caddy digest recorded; container engine unavailable, runtime TLS/proxy behavior pending |
| Windows executable/ZIP and Offline LAN preservation | LOCALLY TESTED | Exact extracted build; package smoke, native Tk diagnostic, authenticated LAN bytes/socket and actual binding records |
| Internet peers on different networks, successful browser TURN relay | BLOCKED / NOT INTERNET VERIFIED | No authorized public service/domain/certificate/relay or separate Internet peers |
| Physical devices and clean Windows install on this build | NOT VERIFIED | User reports previous 0.3.1 PC/phone Offline LAN success; new 0.3.2 checks use same-PC clients only |

## Test record

The full backend regression run, real provider integration, frontend unit/browser results and final artifact hashes are recorded in `ONLINE_0.3.2_EVIDENCE.json` and the current entry in TEST_REPORT.md. The browser suite has one conditional positive relay case skipped without its fixture; it was also explicitly attempted and failed, not silently counted as success. The exact packaged handoff is a repeat variant of the separate-process case, not an extra unique browser scenario.

The real infrastructure run uses disposable PostgreSQL 18 on port 55432, Redis on 56379, Garage S3 on 53900 and coturn on 53578. It does not modify the installed PostgreSQL service. Docker engine and remote CI remain unavailable/not run. Existing dependency-audit records belong to earlier checkpoints unless explicitly rerun.

The separate-process test originally called the wrong Playwright popup API; the harness was corrected to wait on the page's popup event, then the packaged test passed. Earlier teardown timing was corrected by stopping the owned test server before closing browsers. These were test harness fixes; no simulated file transfer is counted as a real one.

## Local relay investigation — failed acceptance gate

An opt-in positive relay test uses a separate loopback coturn fixture on port 53579 with explicitly test-only loopback peer permission. After removing duplicate owned fixture processes, authenticated allocations and CREATE_PERMISSION succeed for both browsers and relay candidates are gathered. Coturn then reports `udp send: Operation not permitted`; ICE connectivity fails. A basic WSL Python UDP loopback probe succeeds, so the evidence does not establish that all UDP is blocked. The failure remains specific to this relay path/environment and is unresolved.

The frontend distinguishes no allocation from an allocated candidate whose connectivity checks fail, and directs the operator to public relay addressing, permissions and relay-port firewall. Raw allocation/permission success does not prove file relay. Positive browser relay, NAT traversal, TURN TLS, different-network transfer and production UDP/TCP reachability remain mandatory external gates. The test is retained for a suitable environment; production private-peer protections were not weakened to obtain a pass.

## Remaining blockers and acceptance

- An approved public deployment target, owned DNS/TLS, public HTTPS website and WSS signaling endpoint; none is configured in the delivered desktop by default.
- A reachable authenticated Internet TURN relay, correct public address/port forwarding, UDP relay egress and optional TLS certificate lifecycle.
- Two physical Internet networks, mobile devices, camera QR scan, long/large transfers, restrictive firewalls and clean Windows acceptance.
- Docker container execution, public proxy identity/TLS validation, production storage/IAM/HA and independent security review.

Use ONLINE_SHARING_GUIDE.md for configuration and the preserved physical checklist. Offline LAN continues independently, with explicit opt-in, pairing/approval, selected physical adapters and trusted-private-network firewall guidance. Local socket/QR checks cannot establish phone reachability.

## Changed source and documentation

- `.env.example`
- `.gitignore`
- `CHANGELOG.md`
- `README.md`
- `apps/desktop/launcher.py`
- `apps/desktop/panel.py`
- `apps/desktop/smoke_acceptance.py`
- `apps/web/e2e/online-config.spec.ts`
- `apps/web/e2e/online-process.spec.ts`
- `apps/web/e2e/sharing.spec.ts`
- `apps/web/package-lock.json`
- `apps/web/package.json`
- `apps/web/src/main.tsx`
- `apps/web/src/online-entry.tsx`
- `apps/web/src/online.tsx`
- `compose.online.yaml`
- `compose.yaml`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/ONLINE_CONTAINER_PIN.json`
- `docs/ONLINE_SHARING_GUIDE.md`
- `docs/ONLINE_SHARING_VERIFICATION.md`
- `docs/PHYSICAL_ACCEPTANCE.md`
- `docs/RELEASE_READINESS.md`
- `docs/ROLLBACK.md`
- `docs/SECURITY_REVIEW.md`
- `docs/TEST_REPORT.md`
- `infrastructure/coturn/start.sh`
- `infrastructure/deployment/Caddyfile`
- `infrastructure/deployment/nginx.conf`
- `infrastructure/deployment/public-realip.conf`
- `pyproject.toml`
- `scripts/e2e_host.py`
- `scripts/prepare_browser_turn.py`
- `scripts/smoke-desktop.ps1`
- `services/lan_server/app.py`
- `services/online_config.py`
- `services/signaling/app.py`
- `services/signaling/distributed.py`
- `services/signaling/ice.py`
- `services/version.py`
- `tests/test_online_config.py`
- `tests/test_signaling.py`
- `docs/ONLINE_0.3.2_EVIDENCE.json`

## Final Windows artifacts

- ZIP: `C:\My Projects\flowdrop\dist\FlowDrop-windows.zip` (25325646 bytes).
- SHA-256: `A1D23B7BB38785F7302280AA00D1848C8439FCE73A76EFC2D681381BFD8E685F`.
- Extracted executable: `C:\My Projects\flowdrop\dist\FlowDrop-online-0.3.2\FlowDrop.exe`; version/build and both manifest hashes verified.
- Final actual TCP addresses: loopback `127.0.0.1:10113`, selected Wi-Fi `192.168.1.7:10125` (plus loopback host listener), explicit wildcard `0.0.0.0:10134`. Native LAN diagnostic used `192.168.1.7:8000` plus `127.0.0.1:8000`. Public-profile automatic exposure was refused; explicit local trusted-adapter selection was exercised.
- Pytest 72 passed / 6 unconfigured integrations skipped, then real integration 6 passed; Vitest 9 passed; browser 20 passed / 1 conditional relay skipped. Exact final packaged handoff repeated successfully (26.6s).
