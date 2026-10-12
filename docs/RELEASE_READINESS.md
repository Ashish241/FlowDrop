# Release readiness — 0.1.0 development checkpoint

**Not production ready. The full project definition of done remains unmet.**

## Completed checks

- [x] Functional React/TypeScript application and production bundle.
- [x] Approved LAN device pairing, authenticated APIs/WebSockets and text sharing.
- [x] Receiver-approved binary/Unicode/empty uploads, streamed assembly and native downloads.
- [x] Duplicate/out-of-order chunks, pause/resume, restart recovery and chunk-size negotiation.
- [x] Three-context broadcast and host-mediated private client-to-client sharing.
- [x] Actual loopback WebRTC, bounded acknowledgement flow, streamed and zero-byte downloads.
- [x] Browser AES-GCM, encrypted metadata, completeness/order checks and encrypted link download/revocation.
- [x] Optical frame protocol and actual QR raster decoding; camera UI implemented.
- [x] Automated accessibility in light/dark themes and five layout widths.
- [x] 16 Pytest, 7 Vitest and 11 Playwright tests passed at the latest checkpoint.
- [x] Python and JavaScript lint, strict TypeScript and production build.
- [x] Python audit: 47 scoped installed dependencies, no known vulnerabilities after urllib3 upgrade.
- [x] npm installation audit: 261 packages, no reported vulnerabilities.
- [x] Initial Alembic migration applied to disposable SQLite database.
- [x] Docker Compose syntax validated with disposable validation settings.
- [x] Windows portable executable/ZIP rebuilt, and API/frontend/worker smoke-tested outside source checkout.

## External acceptance blockers

- [ ] Separate physical PCs/phones; disconnected LAN/hotspot; firewall and mDNS checks.
- [ ] Interactive native control-panel use and a clean Windows target with no Python/Node/Git.
- [ ] Physical camera scanning, exposure/motion behavior, real mobile download behavior.
- [ ] Real Internet direct-P2P and authenticated TURN relay tests, including long sessions.
- [ ] Running PostgreSQL/MinIO/coturn containers. Docker Desktop engine could not start/confirm here.
- [ ] Real PostgreSQL/S3 concurrency, lifecycle/IAM and failure tests.
- [ ] Trusted TLS/reverse-proxy deployment, domain and credentials; external publication approval.
- [ ] Actual large-file/network benchmarks and independent security review.

## Remaining implementation work

- Unified persisted transfer dashboard across engines; online panel navigation/session reconnection.
- Persistent sender management/recovery for Send Later; user cancellation/retry; optional download limits.
- Stronger cloud request-rate policy, trusted-proxy IP configuration and production image pinning.
- Further queue ordering/fairness and comprehensive disk-full/network-loss regression coverage.
- Complete filesystem-race tests, long-running streaming worker/mobile compatibility and receiver disk outcome reporting.
- Further stack consolidation: current UI uses React state and local CSS rather than every preferred styling/state/router library. No artificial shared packages were added.

The ZIP is suitable for local development review and testing, not public release. No cloud resources were provisioned, and no Git push/publication occurred.
