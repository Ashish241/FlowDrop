# Integrated 0.4.0 — INTEGRATED-20261016.1

Current source starts at `b1a3ec2`; the earlier split and working LAN checkpoints are preserved. Desktop and Web now both expose Optical Share and Send Later — Coming Soon. Online adds six-digit temporary codes (10-minute TTL), existing strong room IDs/capabilities and owner approval, cooperative in-session pause/resume, safe text copy/clear/history controls, transfer metadata and measured speed/ETA. Progress stays below 100% until integrity verification. Interrupted WebRTC files still require whole-file resend; in-flight chunks may settle after pause. Resume on the device that paused.

Optical version-1 text remains compatible and version-2 supports files up to 64 KiB. The same QR decoder accepts camera frames or imported images and supports repeated, missing, duplicate and out-of-order frames. Existing offline LAN routing, pairing, resume and firewall/adapter logic are unchanged. See [Optical guide](OPTICAL_SHARING_GUIDE.md) and [current verification](INTEGRATED_VERIFICATION.md).

Send Later is a visible non-upload Coming Soon screen in shipping builds. No cloud API is called by that screen, no new database/storage/payment dependency is added, and the public Nginx `/cloud/` route returns 404. Legacy implementation and its explicitly local combined regression host are retained; it is not part of the shipping website/desktop feature set. No cloud service was deployed.

Public deployment and Internet/TURN/physical-device verification remain open. No push, publication, public deployment or expenses were authorized or performed.

---

# Offline LAN — FlowDrop 0.3.1 / LAN-20261015.2

Extract the **complete** corrected `FlowDrop-windows.zip` into a fresh folder. Double-click `FlowDrop.exe`. The desktop title must show **0.3.1 / LAN-20261015.2**. Do not reuse an older extracted folder or shortcut. The `_internal` folder is required next to the executable.

1. The panel opens **Stopped**, with **This PC Only** as the safe default.
2. Check **Enable Offline LAN Sharing**.
3. FlowDrop automatically selects the sole usable physical Wi-Fi/Ethernet interface. If several are plausible, choose the network shared with the phone in the adapter selector. Virtual interfaces, including WSL/Hyper-V and Windows hotspot adapters, are manual selections only.
4. Press **Start**. On a Public/unknown profile, explicitly confirm that this is a trusted LAN; FlowDrop will not change its profile. A Private-only firewall rule will not permit Public-profile traffic.
5. Wait for **Running**. Only after authenticated HTTP and compiled-frontend readiness passes does the host dashboard open at its **127.0.0.1** URL.
6. Open the **Phone / LAN Connection URL** on the phone, or scan the QR from the panel/dashboard. The host approves the paired device, and recipients separately accept file offers. The QR contains only a short-lived pairing code, never the host authorization capability.

No terminal is required for normal use. Stop/Start, **Restart / Rebind**, **Copy Phone URL**, **Refresh Networks**, **Run Diagnostics**, and explicit private firewall setup are available in the panel.

## Selection and network changes

Windows discovery enumerates adapter hardware/virtual status, operational state, interface index/type/GUID, IPv4 prefix/subnet, default gateway, route/interface metrics and connection profile. It does not make an Internet probe or infer reachability merely from a private address. Automatic selection excludes disconnected, loopback, 169.254/16, virtual and route-less candidates. It never silently falls back to WSL or localhost. If Windows discovery is unavailable, profile/routing information is marked unavailable and automatic selection is disabled; manual active-IP selection remains possible.

Only the selected adapter identity is remembered, never LAN consent or a stale DHCP IP. Startup re-enumerates the interface. Network polling warns about disconnection, DHCP/profile changes; press **Restart / Rebind** after selecting the current network. Restart reuses the current port when available. Otherwise a collision on either LAN or loopback selects an available shared port and updates every URL/QR. No unrelated process is killed.

A PC connected to a phone hotspot uses its own Wi-Fi IPv4. A Windows-hosted hotspot often uses a virtual `Local Area Connection*` interface; select it explicitly only when that is the network the phones use. Multiple adapters can be active on different networks. The phone needs the PC address on its own reachable subnet, not localhost, its own gateway, `0.0.0.0`, or a WSL address. The selected address is not guaranteed reachable through a hotspot/router that isolates clients.

## Host and phone listeners

**This PC Only:** only `127.0.0.1` listens; no phone QR is displayed.

**Offline LAN:** the same application listens on the selected private IPv4 **and** `127.0.0.1`, on one port. The desktop health checks and host dashboard use loopback, without environment proxy routing. Phone URLs and pairing QR always use the selected LAN address. HTTP and WebSocket URLs in the frontend follow the current browser origin. Exact local Host names/IPs and the generated mDNS name are allowed; arbitrary Host headers, cross-origin requests and implicit proxy-header trust are rejected. No wildcard CORS is enabled.

All frontend assets, hashing and optical processing are local at runtime. Installation/build requires dependencies; the portable runtime does not require Python, Node or Internet. LAN HTTP is plaintext; use only trusted networks. CLI trusted-certificate TLS is supported, and the certificate must cover the host loopback and advertised LAN URL for readiness to pass. Physical TLS/device acceptance remains pending.

## Windows firewall

**Run Diagnostics** reports current profile, Windows firewall profile policy, local sockets, authenticated HTTP/frontend checks, LAN-IP checks from the same PC, WebSocket invalid-capability refusal and URL consistency. A missing managed rule means inbound *may* be blocked; other Windows/GPO rules can apply. It is not proof of a specific firewall block. Local checks never mark phone connectivity verified.

For a trusted network, use Windows Settings to select **Private** yourself after verifying that you trust it. FlowDrop never changes the network profile. After a profile change, **Refresh Networks → Restart / Rebind**.

On a Private network, **Allow Private LAN…** displays the exact executable, port and local IP, requests explicit approval and Windows UAC, then creates one deterministic rule scoped to that executable, TCP port, local IP, **Private** and **LocalSubnet**. Repeating the same request verifies the existing rule rather than adding duplicates. Conflicting named rules are rejected. UAC cancellation/policy errors are shown; no Public allow rule or unrelated rule is changed. This elevation path is implemented and unit-reviewed; it was not executed against the user's firewall during engineering verification.

Manual alternative (administrator PowerShell, substitute the real extracted path/IP/port):

```powershell
$taskExe = (Resolve-Path 'C:\path\to\FlowDrop\FlowDrop.exe').Path
New-NetFirewallRule -DisplayName 'FlowDrop Offline LAN manual' -Direction Inbound -Action Allow -Program $taskExe -Protocol TCP -LocalPort 8000 -LocalAddress 192.168.43.105 -Profile Private -RemoteAddress LocalSubnet
Get-NetTCPConnection -State Listen -LocalPort 8000 | Select-Object LocalAddress,LocalPort,OwningProcess
# Remove only the rule you created when no longer needed:
Remove-NetFirewallRule -DisplayName 'FlowDrop Offline LAN manual'
```

Do not disable Windows Firewall or forward FlowDrop's port on an Internet router. If binding/local checks pass but the phone fails, check the phone's subnet, actual profile/rule scope, VPN/proxy routing and hotspot/guest-network client isolation. FlowDrop cannot override router isolation. Optional mDNS `_flowdrop._tcp.local` is not required; use the numeric phone URL when multicast discovery is unavailable.

## CLI and build identification

```powershell
.\FlowDrop.exe --version
.\FlowDrop.exe --build-info
.\FlowDrop.exe --help
.\FlowDrop.exe --list-adapters
.\FlowDrop.exe --lan --port 8000
.\FlowDrop.exe --lan --bind 192.168.43.105 --port 8000
.\FlowDrop.exe --bind 127.0.0.1 --port 8000
```

Substitute the actual IP from `--list-adapters`. `--lan` alone selects a unique physical candidate on a Private profile. Multiple candidates require explicit `--bind`; a Public profile also requires explicit trusted-interface selection rather than automatic exposure. `--lan --bind 0.0.0.0` is an advanced explicit wildcard option; selected-interface mode is preferred. The build ID in `--version`, desktop title and `BUILD_INFO.json` must match. The manifest records the executable and frontend index SHA-256 hashes.

Developer checks: `python -m pytest -q`, frontend lint/build/unit/Playwright, `python -m scripts.integration_check` against disposable infrastructure. Build with `powershell -File scripts/build-desktop.ps1`; extract the resulting ZIP into a fresh folder and run `python -m scripts.smoke_network --exe dist/FlowDrop-windows/FlowDrop.exe`. The packaged `--panel-smoke` exercises actual hidden Tk widgets/readiness/QR/restart and records no physical-phone claim. Neither check substitutes for a clean Windows or physical-device acceptance run.
