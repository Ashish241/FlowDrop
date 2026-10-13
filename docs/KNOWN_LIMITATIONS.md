# Known limitations — v0.2.0

This is a development checkpoint, not a public release.

- Online rooms survive navigation and can be explicitly reconnected after refresh while the signaling process retains the room. Files interrupted by a peer disconnect must be resent; byte-level WebRTC restart resume is unavailable. Rooms expire after one hour. Signaling state is in memory, with no Redis implementation or multi-worker support.
- Sender link management, upload keys and online history are scoped to sessionStorage in one browser tab. Closing the tab loses management capabilities. Reselecting the original file permits encrypted upload recovery; a different file is refused. One Send Later share is managed at a time. Pausing aborts the current request; revoking deletes the abandoned share. Expiry also cleans abandoned chunks.
- Optional download limits count session issuance, including interrupted/decryption/save failures. A session can re-request chunks for up to one hour. They cannot enforce deletion or prevent redistribution.
- The dashboard combines server-authorized LAN history with tab-scoped online history. Online speed/ETA and participant labels remain incomplete. History is bounded to 100 entries. Active WebRTC history after refresh describes the prior attempt; reconnect and resend explicitly.
- Native browser downloads and service-worker streams cannot certify that a user saved a file to durable disk. The UI reports verification and handoff; inspect browser downloads for final success.
- Backend chunk concurrency is bounded; persistent queue reordering, quantified fairness, and broad network/disk/race/shutdown fault testing remain incomplete.
- HTTP LAN, mobile service-worker compatibility, physical QR camera scanning, adapter/firewall/mDNS behavior and native GUI interaction need physical acceptance.
- Docker's Linux engine is unavailable in this environment. PostgreSQL, S3-compatible services, coturn, production TLS/proxy and Redis have not been integration verified.
- Container image digests are not pinned. Python lock is Windows-specific; frontend package-lock pins installed resolution. Dependency audits cannot certify an application.
- CI is configured but has not run on GitHub. Nothing has been pushed, deployed or publicly released.
