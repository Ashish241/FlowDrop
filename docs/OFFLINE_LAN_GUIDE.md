# Offline LAN

Installation and build require internet; runtime serves all assets locally and performs no external fetches. Only the PC host needs the application. Other computers and phones use browsers.

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
