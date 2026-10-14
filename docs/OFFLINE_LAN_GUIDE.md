# Offline LAN

Installation and build require internet; runtime serves all assets locally and performs no external fetches. Only the PC host needs the application. Other computers and phones use browsers.

Loopback is the safe default: CLI `FlowDrop.exe --no-browser` listens on `127.0.0.1:8000`. Double-click opens the desktop panel and starts in **This PC only** mode. To connect phones: **Stop host**, check **Enable Offline LAN sharing**, choose the adapter on the same network as the phones, and **Start host**. The panel uses an available port; copy its complete displayed URL.

For CLI use (from the extracted portable folder):

```powershell
.\FlowDrop.exe --list-adapters
.\FlowDrop.exe --lan --port 8000
# Select explicitly when multiple networks are active:
.\FlowDrop.exe --lan --bind 192.168.43.105 --port 8000
# Optional all-interface listener; requires explicit LAN consent:
.\FlowDrop.exe --lan --bind 0.0.0.0 --port 8000
# Disable LAN / retain loopback-only mode:
.\FlowDrop.exe --bind 127.0.0.1 --port 8000
```

`--lan` automatically chooses an active private IPv4 adapter, preferring Wi-Fi/Ethernet over virtual adapters. Link-local, loopback and disconnected adapters are excluded. It never needs Internet access. With multiple physical networks, select explicitly: a Windows-hosted hotspot often uses `192.168.137.1`; a PC connected to a phone hotspot uses the PC's Wi-Fi address. The phone must open the **PC address**, not its own gateway, localhost, or `0.0.0.0`. A private `--bind` remains an explicit LAN opt-in for older commands. Without a usable adapter LAN startup fails with guidance rather than silently falling back to localhost. Restart after changing networks or DHCP addresses.

The console prints both the listening address and the usable Connection URL. The host dashboard receives that canonical URL from the launcher and generates its pairing QR from it, even if a wildcard listener's dashboard is opened through localhost. Pairing QR contains only the short-lived pairing code, never the host authorization token. All frontend HTTP and WebSocket paths use the device's current origin. No wildcard CORS is enabled; unexpected Host headers and cross-origin requests are rejected. Desktop Uvicorn ignores proxy headers.

Find adapters using `python -m apps.desktop.launcher --list-adapters`. Choose the private Wi-Fi/Ethernet/hotspot adapter, then run:

```powershell
python -m apps.desktop.launcher --bind 192.168.1.10 --port 8000
```

Use your actual adapter address. On an occupied port choose another port or use `--port 0` to select an available one. Open the displayed URL on other devices. Enter the host pairing code or scan its QR. The host must approve each device; receivers must separately accept file offers. Revocation blocks subsequent requests. The host console shuts down with Ctrl+C.

For firewall trouble, permit the application on your Windows **private** network profile through Windows Firewall. FlowDrop does not change firewall settings automatically. Disable Wi-Fi client isolation or use another trusted network when clients cannot reach one another. VPNs and guest networks may block access. The public hosted site cannot safely substitute for the locally served interface.

The current transport uses unencrypted HTTP. Use trusted local networks only. Service discovery advertises `_flowdrop._tcp.local` when supported; manual IP always remains available. Browser and mobile mDNS discovery support varies.

LAN downloads use native browser streaming through short-lived, path-scoped HttpOnly cookies. JavaScript does not buffer the entire download. Browser download permissions, file naming and disk progress remain browser managed. HTTP is still plaintext. Configure trusted TLS certificates with --tls-cert/--tls-key for untrusted networks; actual TLS device testing remains pending.

FLOWDROP_CHUNK_SIZE supports 1048576, 2097152 or 4194304 bytes. FLOWDROP_UPLOAD_CONCURRENCY accepts 1–16 (default 4). Transfer records preserve their negotiated size across configuration changes. Browser uploads allow two simultaneous files; chunks time out after sixty seconds and can be retried.

Double-clicking the executable opens native adapter/start/stop controls and the browser dashboard. CLI mode remains available; --gui explicitly opens the panel. Interactive GUI and clean target-PC testing are pending.

## Windows build

Run `powershell -File scripts/build-desktop.ps1` after the frontend build. The portable folder bundles Python and frontend assets. The ZIP is a build artifact, not a release endorsement. Actual target-PC offline testing remains required.

## Windows firewall and binding checks

On a **trusted** home/hotspot network, check `Get-NetConnectionProfile`. If the profile is Public, a Private-only rule will not apply. Change the specific network to Private through Windows Settings only after confirming you trust it. FlowDrop does not change network profiles or firewall rules automatically.

For a fixed CLI port of 8000, an administrator can add a narrow inbound rule (replace the executable path):

```powershell
$taskExe = (Resolve-Path 'C:\path\to\FlowDrop\FlowDrop.exe').Path
New-NetFirewallRule -DisplayName 'FlowDrop Offline LAN' -Direction Inbound -Action Allow -Program $taskExe -Protocol TCP -LocalPort 8000 -Profile Private -RemoteAddress LocalSubnet
Get-NetTCPConnection -State Listen -LocalPort 8000 | Select-Object LocalAddress,LocalPort,OwningProcess
# Remove this specific rule when no longer needed:
Remove-NetFirewallRule -DisplayName 'FlowDrop Offline LAN'
```

For a panel-selected port, use the port shown in its URL. Prefer binding a specific adapter; `0.0.0.0` also listens on other interfaces, so retain Private/LocalSubnet firewall scope. Do not disable Windows Firewall, permit Public networks, or forward the port on an Internet router. Revisit the rule if the executable moves. mDNS is optional; use the numeric URL when multicast discovery is blocked.

Expected listener: `127.0.0.1` in local-only mode, the selected LAN IPv4 with `--lan`, or `0.0.0.0` only with the explicit wildcard option. If the listener is correct but phones cannot connect, check subnet, the firewall profile/rule, VPN routing and hotspot/client isolation. The application cannot override isolation enforced by a hotspot/router. Test from another device separately; successful requests from this PC to its LAN IP do not establish physical-phone reachability.

Regression commands: `python -m pytest tests/test_desktop_network.py -q`; after rebuilding, `python -m scripts.smoke_network` tests actual executable loopback, automatic LAN, selected LAN and wildcard sockets, HTTP/frontend and WebSocket authentication. This local socket test records `.flowdrop/network-smoke.json` and is not physical-device acceptance.
