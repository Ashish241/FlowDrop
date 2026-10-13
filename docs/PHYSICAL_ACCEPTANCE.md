# Physical acceptance plan

All cases below are **NOT VERIFIED**. Use disposable non-sensitive files and record devices, OS/browser versions, network topology, file hashes, logs without capabilities, elapsed time and pass/fail. Compare SHA-256 of source and saved copy (`Get-FileHash -Algorithm SHA256` on Windows). A matching server hash alone is insufficient.

| Case | Procedure and acceptance |
|---|---|
| PC to PC Ethernet | Disconnect WAN; start the ZIP executable, select the Ethernet adapter, open its displayed IP on the other PC, pair and approve. Transfer empty, Unicode-named and 1 GiB files both ways; saved hashes must match. |
| PC to mobile Wi-Fi | Join the same router; disable cellular fallback. Pair using QR/manual IP, approve, accept file, check browser download completion and compare hashes with a device tool. |
| Mobile to PC | Select a phone file, offer to host, accept on PC and save. Repeat with two simultaneous sends; no unauthorized device should see either payload. |
| Mobile to mobile | Two phone browsers connect to the Windows host. Send directly between approved phone identities through the host; verify unrelated client visibility and saved files. |
| No internet LAN | Disconnect router WAN before startup; repeat pairing, files and text. Browser developer tools must show no required external assets. |
| Offline hotspot | Disable cellular data; connect host and another browser device to hotspot. Use displayed host IP if mDNS fails. Repeat transfer in both directions. |
| Host restart | Interrupt a >100 MiB upload, stop/start host with the same data directory, reconnect recipient, reselect original file on sender and resume. Check checkpoints and full saved hash. Changed file must be refused. |
| Firewall | With a private-network rule denied, confirm manual IP fails with useful troubleshooting; allow only the selected executable/private network and retry. Do not disable the entire firewall. |
| mDNS/fallback | Resolve the advertised local service from another device; repeat on a network blocking multicast using numeric IP. Record mDNS failure separately from successful fallback. |
| Camera QR | On HTTPS/localhost-capable camera UI, scan animated frames from a second screen under normal/dim light and motion. Pause/remove frames, resume, and verify Unicode text exactly; corrupted/incomplete streams must not produce accepted text. |
| Internet WebRTC | Deploy approved test signaling/TLS; place peers on separate ISPs. Approve, transfer large/empty files and text, refresh/reconnect, compare hashes and selected candidate types. This is distinct from loopback. |
| Authenticated TURN | Use disposable coturn credentials and force relay in a test configuration. Confirm relay candidate, matching saved hashes, invalid/expired credential refusal, bounded ports and no open relay. |
| Performance | Measure 1/5/10 GiB transfers, single and four clients; report elapsed bytes/seconds, RSS sampled every second on host/clients, CPU, hardware and network. Test cancellation, full disk and interrupted links. Do not extrapolate ASGI timings to network throughput. |
| Clean Windows | Extract ZIP on a supported clean Windows machine with no Python/Node/Git, internet disconnected. Test GUI, API/frontend, file transfer, stop/restart and process exit; verify no external runtime installation is required. |

Public release requires named evidence for these cases and the infrastructure/security gates in RELEASE_READINESS.md.
