# Integrated 0.4.0 — INTEGRATED-20261016.1

Current source starts at `b1a3ec2`; the earlier split and working LAN checkpoints are preserved. Desktop and Web now both expose Optical Share and Send Later — Coming Soon. Online adds six-digit temporary codes (10-minute TTL), existing strong room IDs/capabilities and owner approval, cooperative in-session pause/resume, safe text copy/clear/history controls, transfer metadata and measured speed/ETA. Progress stays below 100% until integrity verification. Interrupted WebRTC files still require whole-file resend; in-flight chunks may settle after pause. Resume on the device that paused.

Optical version-1 text remains compatible and version-2 supports files up to 64 KiB. The same QR decoder accepts camera frames or imported images and supports repeated, missing, duplicate and out-of-order frames. Existing offline LAN routing, pairing, resume and firewall/adapter logic are unchanged. See [Optical guide](OPTICAL_SHARING_GUIDE.md) and [current verification](INTEGRATED_VERIFICATION.md).

Send Later is a visible non-upload Coming Soon screen in shipping builds. No cloud API is called by that screen, no new database/storage/payment dependency is added, and the public Nginx `/cloud/` route returns 404. Legacy implementation and its explicitly local combined regression host are retained; it is not part of the shipping website/desktop feature set. No cloud service was deployed.

Public deployment and Internet/TURN/physical-device verification remain open. No push, publication, public deployment or expenses were authorized or performed.

---

# 0.4.0 limits

The Online Web target needs separately authorized hosting; it is not currently public. The free memory backend loses rooms on sleep/restart, cannot be scaled beyond one worker, and may aggregate anonymous rate limits behind an untrusted provider proxy. Default STUN is direct-first, not guaranteed NAT traversal; successful TURN relay remains blocked. Folder selection saves individual files, not directory trees. WebRTC retry resends the full file; streaming/download/browser quotas still apply. The combined Send Later interface is retained for development/regression but omitted from both shipping product navigations. See FREE_HOSTING.md and SPLIT_VERIFICATION.md.

---

# 0.3.2 online limitations

Online Sharing requires an operator-configured public HTTPS frontend and WSS signaling service. None is provisioned/configured by default; the desktop clearly reports unavailable and Offline LAN remains usable. Restricted NATs need a reachable authenticated TURN relay. Local allocation/auth tests passed, but the actual browser relay fixture fails when coturn forwards UDP (`Operation not permitted`); no Internet relay/file transfer claim is made.

Desktop handoff opens the hosted site in a separate tab; it does not embed remote RPC inside the LAN origin. Browser source storage quotas, 128 MiB non-streaming fallback, whole-file WebRTC retry and room expiration limits remain. No new-build physical phone, separate Internet networks, clean Windows, production TLS/container or large mobile acceptance was performed. See [current evidence](ONLINE_SHARING_VERIFICATION.md).

---

# 0.3.1 network acceptance limits

- Physical phone/second-PC reachability, camera QR scanning, clean Windows and human GUI usability remain UNVERIFIED. Automated Tk tests use hidden native widgets, and local LAN clients run on the host PC.
- This Wi-Fi currently has a Public profile and all firewall profiles default inbound Block. No managed allow rule was created. Other policies may affect reachability; the application cannot certify a firewall or router path from local probes.
- Windows automatic adapter selection requires hardware/route inventory. If discovery is denied/unavailable, automatic selection fails closed and explicitly selected active IPs remain available with unknown-profile confirmation.
- The GUI polls network metadata approximately every ten seconds. An abrupt change can interrupt transfers until Restart/Rebind. Network ambiguity requires a user selection; no IP is assumed universally reachable. TLS certificates must cover the loopback dashboard and LAN address.
- Optional firewall elevation is implemented and its script is unit-tested, but actual UAC approval/rule mutation remains unexecuted. Router client isolation, VPN policies and deployed Internet/TURN/TLS/HA gates remain external.

---

# Known limitations — v0.3.0

This is a development checkpoint, not a public release.

- Redis mode shares rooms, capability hashes, approval, connection generations and rate counters across workers. Memory mode is development-only and cannot distribute rooms. Redis Pub/Sub does not replay lost messages; reconnect and renegotiate. Redis HA/failover and large-scale load remain unverified.
- Source files are stored in browser IndexedDB when quota permits, scoped to the sender capability. LAN resumes checkpoints; WebRTC restores pending files but restarts interrupted files from byte zero with fresh recipient approval. Send Later restores its source and skips uploaded ciphertext chunks. Browser storage failure requires reselecting the original file. Expired source entries are removed opportunistically when recovery runs, not by a continuously running background service.
- Wait for source hashing/preparation and persistence to finish before refreshing. Files in an unprepared selection batch have not yet become durable queue entries. New authentication capabilities intentionally cannot retrieve another session's cached source; reselect the original after a host-capability change.
- Sender link keys/capabilities remain tab-scoped; closing a tab loses Send Later management capabilities even if an old source File remains in IndexedDB. One Send Later share is managed at a time. Shared browser profiles, extensions or same-origin scripts can access local browser storage; this is not encrypted storage against a local profile adversary.
- Optional download limits count session issuance, including interrupted/decryption/save failures. A session can re-request chunks for up to one hour. They cannot enforce deletion or prevent redistribution.
- The dashboard shows directions, participants, bytes, progress, sampled rates/ETA and state. Estimates are measured locally and may fluctuate; they are not network guarantees. WebRTC history is filtered by current room/member session. History is bounded to 100 online entries. Persistent fair chunk scheduling is implemented for LAN; online sends remain serial and encrypted uploads remain chunk-serial.
- Native browser downloads and service-worker streams cannot certify that a user saved a file to durable disk. The UI reports verification and handoff; inspect browser downloads for final success.
- Browser round-robin admission/concurrency/failure release is tested. User queue reordering, cross-process cloud fairness, long worker-stream/mobile sessions and comprehensive filesystem/reparse-point race tests remain incomplete.
- HTTP LAN, mobile service-worker compatibility, physical QR camera scanning, adapter/firewall/mDNS behavior and native GUI interaction need physical acceptance.
- Native PostgreSQL 18, WSL Redis 8.0.5, Garage 2.4.1 and built coturn 4.18.0 were tested with disposable services. Docker image builds/runs, production proxy/TLS, cloud HA and Internet TURN relay remain unverified. Local TURN allocation/authentication is not Internet relay verification.
- Supported container manifests are digest-pinned; old MinIO profiles are unsupported. Windows dependency lock lacks artifact hashes and is not a Linux lock. Dependency audits cannot certify the application or native dependencies.
- CI is configured but has not run on GitHub. Nothing has been pushed, deployed or publicly released.
