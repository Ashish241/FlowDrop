# Release readiness — 0.2.0 development checkpoint

**Not production ready. The full project definition of done remains unmet.**

Updated 2026-10-13. v0.2.0 adds navigation-safe online panels, tab-scoped online history, explicit room reconnect, encrypted upload refresh/retry management, optional download-session limits, retryable storage failures, bounded abuse controls and explicit proxy trust. See TEST_REPORT.md, SECURITY_REVIEW.md, KNOWN_LIMITATIONS.md and PHYSICAL_ACCEPTANCE.md for current evidence and limits. The original completed checks below are v0.1.0 baseline evidence; current counts/results are maintained in TEST_REPORT.md.

| Gate | Status |
|---|---|
| LAN, WebRTC, encrypted links, optical text | IMPLEMENTED; automated loopback tests |
| Navigation/reconnect, encrypted upload resume and limits | IMPLEMENTED; AUTOMATED TESTED |
| Unified history | IMPLEMENTED partially; online speed/ETA, participant labels and full controls remain incomplete |
| Storage failures, proxy trust and bounded rate controls | IMPLEMENTED; AUTOMATED TESTED |
| PostgreSQL/S3/TURN/TLS/container integration | BLOCKED by unavailable engine/test infrastructure; NOT VERIFIED |
| Redis signaling | Not implemented; single-process room state only |
| Physical acceptance / clean Windows / native GUI | NOT VERIFIED; checklist supplied |
| Release | NOT RELEASE READY |

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

- Finish dashboard participant labels/speed/ETA and full online controls; persisted fair queue scheduling and byte-level WebRTC recovery.
- Durable multi-share sender management beyond one browser tab; automatic reconnect and longer/mobile sessions.
- Distributed abuse controls, Redis signaling and production image digest pinning.
- Further queue ordering/fairness and comprehensive disk-full/network-loss regression coverage.
- Complete filesystem-race tests, long-running streaming worker/mobile compatibility and receiver disk outcome reporting.
- Further stack consolidation: current UI uses React state and local CSS rather than every preferred styling/state/router library. No artificial shared packages were added.

The ZIP is suitable for local development review and testing, not public release. No cloud resources were provisioned, and no Git push/publication occurred.
