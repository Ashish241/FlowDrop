# Offline LAN connectivity verification — 2026-10-15

Starting checkpoint: `95eee29`. Windows 11 / Python 3.14.6 / Node 24.18.0. The prior CLI default was loopback and the QR used the dashboard origin; no explicit Offline LAN toggle existed in the native panel.

Implemented explicit LAN consent, shared active-interface detection, selected-interface binding and optional `--lan --bind 0.0.0.0`. Loopback remains the default. The native panel requires Stop → enable Offline LAN → select adapter → Start. CLI `FlowDrop.exe --lan --port 8000` selects an active private address; `--list-adapters` and `--bind` handle multiple networks. There is no Internet dependency in interface detection.

The launcher passes its canonical connection URL to the authenticated host session. Both displayed URL and pairing QR use that address, including when a wildcard host dashboard is opened over localhost. The short-lived pairing code does not confer host privileges. Existing device approval, recipient acceptance, capability authorization and same-origin HTTP/WS checks are retained. Exact local Host names/IPs and generated mDNS hostname are allowed; arbitrary Host headers and implicit forwarded-header trust are rejected. No firewall or network-profile change was made.

## Actual final executable listeners

`python -m scripts.smoke_network` launched the rebuilt executable separately in each mode, inspected its real Windows TCP sockets through psutil, requested its frontend, worker and health endpoint through the advertised address, verified unauthorized transfers return 401, rejected hostile Host/Origin headers, and verified WebSocket capability refusal closes with 1008. Every diagnostic process exited normally. Ports below were ephemeral (`--port 0`).

| Mode | Actual listening address | Advertised URL | Local TCP/HTTP/WS checks |
|---|---|---|---|
| loopback | `127.0.0.1:11526` | `http://127.0.0.1:11526` | Passed |
| lan-auto | `192.168.1.7:8608` | `http://192.168.1.7:8608` | Passed |
| lan-selected | `192.168.1.7:8633` | `http://192.168.1.7:8633` | Passed |
| lan-all | `0.0.0.0:8646` | `http://192.168.1.7:8646` | Passed |

A separate final-executable run used `--lan --bind 192.168.1.7 --port 8000`. PowerShell `Get-NetTCPConnection -LocalPort 8000 -State Listen` reported `LocalAddress: 192.168.1.7`, `LocalPort: 8000`, `OwningProcess: 28008`. `http://192.168.1.7:8000/api/health` returned `status: ok`. The diagnostic process then shut down normally. These are recorded test results, not a claim that the diagnostic listener remains running.

Windows also reported hotspot adapter `192.168.137.1`; select it explicitly when that is the network the phones use. Automatic selection preferred Wi-Fi `192.168.1.7`. The Wi-Fi profile was Public during inspection; Private-only inbound rules will not apply until the user verifies the network is trusted and selects Private. See [OFFLINE_LAN_GUIDE.md](OFFLINE_LAN_GUIDE.md) for a narrow executable/TCP/Private/LocalSubnet rule and troubleshooting. FlowDrop did not modify the firewall or profile.

## Automated regressions and package

- Pytest: **32 passed**, including 11 new adapter/startup/host/origin/pairing cases. Six provider integration cases were explicitly skipped because disposable Redis/PostgreSQL/S3/TURN services were not configured for this LAN-only run; prior provider evidence is retained separately.
- Vitest: **9 passed**.
- Playwright: **14 passed (35.7s)**, covering all 13 existing scenarios and a new test decoding the actual rendered QR to assert the selected LAN URL while the dashboard uses loopback. Decoder is served through a test-only same-origin route, preserving CSP. Initial QR harness checks exposed PNG encoder differences and inline-script CSP restrictions; both were corrected in the test without weakening application policy.
- Ruff, ESLint, strict TypeScript and production Vite build passed.
- Final clean PyInstaller build and Windows smoke passed: version/help, frontend, download worker, API and graceful shutdown from outside the checkout. Four-mode native network smoke and fixed-port PowerShell verification passed on that final bundle.
- ZIP: `dist/FlowDrop-windows.zip`, **25,230,128 bytes**, SHA-256 **9912DD2F4A53D0306166FB67CF5506B0F6EE0254A549E99B3C2E18F7E99138ED**. Extract the complete ZIP; the executable requires its bundled `_internal` directory.

## Verification boundary

All requests originated on this Windows PC, including requests to its LAN IP. No physical phone, second PC, actual disconnected hotspot, external firewall traversal, mobile camera, clean Windows machine or interactive native GUI was tested. mDNS hostname compatibility is covered by the host validation regression, not physical multicast discovery. Router/hotspot client isolation and the Public-profile firewall remain separate reachability checks. The broader release gates remain open; this fix is not production certification.
