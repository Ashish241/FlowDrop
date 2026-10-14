# FlowDrop 0.3.1 — LAN-20261015.2 — 2026-10-15

Starting source checkpoint: `7c1c487`. The repository was clean. Current delivery is `dist/FlowDrop-windows.zip`, extracted and tested at `dist/FlowDrop-windows/FlowDrop.exe`.

## Confirmed causes and diagnosis

There were two different 0.3.0 executables in `dist`. `dist/FlowDrop/FlowDrop.exe --help` supported `--lan`, but **`dist/FlowDrop-windows/FlowDrop.exe --help` did not**. Both printed 0.3.0. This reproduces the reported executable/documentation mismatch; the exact executable path used by the user outside this checkout cannot be established retrospectively. The stale extraction is preserved, labeled, under `dist/checkpoints/stale-extracted-0.3.0-no-lan`.

Earlier selection depended on adapter enumeration or name ranking rather than Windows hardware/route/profile metadata, making virtual-network selection unreliable. Discovery now identifies physical hardware and refuses automatic WSL/Hyper-V/hotspot virtual fallback. The old LAN launcher used the LAN address for the host browser too, lacked a dedicated loopback listener, and failed rather than recovering when the chosen port was occupied. Native error handling/readiness lacked the diagnostic separation needed to identify these cases.

Port 8000 was occupied during this run. The new launcher recovered to an available shared port without terminating that existing process. Wi-Fi is currently **Public**, and Windows reports Domain/Private/Public firewalls enabled with default inbound Block. No FlowDrop managed rule was present for the tested extracted executable/IP/port. Other effective allow/block/GPO rules may apply; these facts do not prove a specific firewall cause for the historical phone failure. Router/client-isolation and physical-phone reachability remain unverified.

## Corrected behavior

Windows networking inventory enumerates name, interface index/GUID/type, IPv4 prefix/subnet, gateway, operational state, physical/virtual classification, connection profile and routing priority. Actual Wi-Fi: `192.168.1.7/24`, index 18, gateway `192.168.1.1`, metric 30, type Wi-Fi (71), Public. WSL `172.20.176.1` and hotspot `192.168.137.1` are virtual/manual-only. Link-local/disconnected Ethernet is excluded. No IP is hardcoded.

Automatic selection requires a unique usable physical interface with a local route; multiple physical candidates require a clear explicit selection. Previously selected adapter identity is remembered and revalidated against current IP/profile each startup. LAN consent is not persisted. If native Windows metadata is unavailable, automatic selection fails closed and the manual path identifies missing routing/profile information. Discovery/polling and probes run outside the Tk UI thread. Disconnection, DHCP/profile changes and startup failures have visible diagnostics and Restart/Rebind recovery.

Double-click opens a **Stopped**, This PC Only panel. Enable Offline LAN, choose/confirm the trusted interface and Start. LAN mode creates two sockets on one port: selected LAN IPv4 and `127.0.0.1`. Host browser opens only after host authentication, HTTP health and compiled-frontend checks pass, using the **loopback** dashboard URL. Phone URL/QR uses only the selected LAN IP. This PC Only creates no phone QR. Port collisions on either socket recover to an available shared port; restart retains the selected port when possible. No unrelated process is killed.

The panel displays status, mode, adapter/IP/port, separate URLs, Copy URL, native QR/code, diagnostics, Start/Stop/Restart and network refresh. Run Diagnostics reports local socket/HTTP/frontend/auth/WS/URL checks and current network/firewall metadata. It never labels local requests as phone verification. Public/unknown networks require explicit trust confirmation. Firewall setup is optional, requires approval/UAC and is scoped to executable, TCP port, selected IP, Private and LocalSubnet; it was not executed during this verification.

Pairing, host approval, recipient acceptance, capability scoping, same-origin HTTP/WS and exact Host protections remain. Host capabilities are never encoded in pairing QR. Local readiness bypasses environment HTTP proxies. All existing LAN/offline/WebRTC/Send Later/optical functionality remains covered by regression tests.

## Actual exact-artifact verification

The production frontend and PyInstaller bundle were rebuilt, then the final ZIP was extracted into the formerly stale delivery directory. Its manifest/executable hashes match. Extracted `--version` reports **FlowDrop 0.3.1 (LAN-20261015.2)**; `--help` includes `--lan`; `--build-info` identifies its actual extracted executable path. The portable build's ordinary smoke ran outside the source checkout.

The following native socket checks ran against the exact extracted executable. Ports were ephemeral. LAN-selected mode also had a loopback listener on the same port and was tested through both URLs.

| Mode | Actual bind | Port | Result |
|---|---|---|---|
| lan-auto-public | `none` | none | correctly requires explicit trusted-network selection; no silent exposure |
| loopback | `127.0.0.1` | 1982 | passed |
| lan-selected | `192.168.1.7` | 1992 | passed |
| lan-all | `0.0.0.0` | 2021 | passed |

The extracted `--panel-smoke` created actual hidden Tk widgets outside the checkout, started safe loopback mode, selected actual Wi-Fi, confirmed Public-network testing via the diagnostic harness, restarted to dual listeners, generated a native pairing QR and automatically opened only captured readiness-passed URLs. It completed an authenticated **256 KiB hash-matched file transfer/download and WebSocket text echo** through the LAN address using local clients, ran diagnostics, detected a **mocked** stale-DHCP event, rebound the real adapter, retained the port, and shut down normally. This is native widget/lifecycle automation, not human visual/usability or physical-device verification.

Recorded native panel host URL: `http://127.0.0.1:14318`; phone URL: `http://192.168.1.7:14318`. They are diagnostic records, not a claim that the test server is still running.

## Regression results

- **50 Pytest passed** in the baseline invocation; six provider cases were skipped only in that unconfigured invocation and then **all 6 passed separately** against real disposable PostgreSQL, Redis, Garage S3 and coturn.
- **9 Vitest passed**; **15 Playwright passed (43.3s)**, including all existing scenarios, LAN QR decoding and no phone QR in This PC Only.
- Ruff, ESLint, strict TypeScript and Vite production build passed. The final frontend label is 0.3.1.
- Windows executable ordinary smoke, native panel acceptance and real socket checks passed against the rebuilt/extracted artifact.
- Python pinned dependency audit (including qrcode 8.2) reports no known findings. The retained warnings are upstream Starlette/httpx deprecation, intermittent Windows Proactor teardown reset, pip-audit's unhashed-lock warning, and old disposable coturn configuration deprecation warnings. No failure was hidden by disabling protections.

Initial concurrent final-artifact tests exceeded startup/outer harness deadlines and were not counted as passes. After isolating the runs, the exact final socket checks and native acceptance passed sequentially. The socket harness now permits a bounded 45-second startup interval and retains failure logs. Windows CIM/profile discovery can be slow under concurrent diagnostics; timeout/unavailable metadata produces explicit errors/manual-selection guidance rather than virtual or loopback fallback.

The native QR encoder (qrcode 8.2) and WebSocket client runtime (16.1.1) are explicitly declared/pinned; the final bundle already used those exact installed versions in its successful checks.

## Delivery and rollback

ZIP: `dist/FlowDrop-windows.zip`, **25,318,163 bytes**. SHA-256 **46AFB58F60D56ADC9BAE58DD7B77757D5290483A7A59F53CC499B1E5EC5BA4D5**.

Executable SHA-256: **90848B3353EC1DB2ACAEE3823D3CE817D10C047C38F0356AF4B642B5EDF2540E**. `BUILD_INFO.json` contains matching executable/frontend hashes and unique build identity. Extract all files into a fresh folder and replace old shortcuts. The working predecessor ZIP is preserved at `dist/checkpoints/FlowDrop-0.3.0-lan-fix1.zip` with its original SHA-256 `9912DD2F4A53D0306166FB67CF5506B0F6EE0254A549E99B3C2E18F7E99138ED`. See [ROLLBACK.md](ROLLBACK.md).

## Remaining physical acceptance

On a trusted Private network, launch this exact build, enable LAN, Start, confirm host readiness, apply the optional narrow rule only if needed, and open the shown phone URL from a real phone. Pair and approve, send files in both directions, compare bytes/hash, test camera QR, disconnect/reconnect/change DHCP and use Restart/Rebind. Test clean Windows and human desktop usability separately. If local checks pass but phone access fails, record phone subnet, current Windows rule/profile, VPN/proxy and hotspot client-isolation behavior. No physical phone or second PC was available here. Real UAC rule mutation, deployed router/firewall traversal and physical mDNS discovery remain NOT EXECUTED/UNVERIFIED.

No push, publication, paid provisioning or public deployment occurred. This is not production-readiness certification. Machine-readable evidence: [LAN_0.3.1_EVIDENCE.json](LAN_0.3.1_EVIDENCE.json). User launch/firewall instructions: [OFFLINE_LAN_GUIDE.md](OFFLINE_LAN_GUIDE.md).

## Changed files

- `CHANGELOG.md`
- `README.md`
- `apps/desktop/diagnostics.py`
- `apps/desktop/firewall.py`
- `apps/desktop/launcher.py`
- `apps/desktop/network.py`
- `apps/desktop/panel.py`
- `apps/desktop/smoke_acceptance.py`
- `apps/web/e2e/lan-url.spec.ts`
- `apps/web/package-lock.json`
- `apps/web/package.json`
- `apps/web/src/main.tsx`
- `docs/DEPENDENCY_AUDIT.json`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/LAN_0.3.1_EVIDENCE.json`
- `docs/LAN_CONNECTIVITY_VERIFICATION.md`
- `docs/OFFLINE_LAN_GUIDE.md`
- `docs/RELEASE_READINESS.md`
- `docs/ROLLBACK.md`
- `docs/SECURITY_REVIEW.md`
- `docs/TEST_REPORT.md`
- `pyproject.toml`
- `requirements-windows.lock`
- `scripts/build-desktop.ps1`
- `scripts/smoke-desktop.ps1`
- `scripts/smoke_network.py`
- `services/lan_server/app.py`
- `services/version.py`
- `tests/test_desktop_network.py`
