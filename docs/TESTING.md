# Test report

This page preserves v0.1.0 evidence below. Current v0.2.0 results are in [TEST_REPORT.md](TEST_REPORT.md): 21 Pytest, 7 Vitest and 12 Playwright passed, plus lint/build, scoped dependency audits, SQLite migration 0002 and Windows executable smoke. Disk-full assembly recovery is now automated-tested; physical filesystem races remain unverified.

Tests run on Windows on 2026-10-12. Commands and latest checkpoint results:

| Check | Result | Scope |
|---|---|---|
| Pytest | 16 passed, one upstream deprecation warning | ASGI LAN/signaling/cloud, negotiated restart resume, atomic SQLite quota/orphan cleanup |
| Vitest | 7 passed | Bounded SHA-256; AES-GCM tampering/order/count; optical recovery and actual QR raster decode |
| Strict TypeScript + Vite | Passed | Bundled frontend production build |
| Ruff / ESLint | Passed | Source lint checks |
| Playwright | 11 passed in 20.5s | Real saved bytes, 3-client privacy/broadcast, streamed/empty P2P, encrypted links, 5 widths, both WCAG themes and worker activation |
| Windows portable executable | Passed | Help, loopback API, compiled frontend and worker from a temporary working directory outside the checkout |
| Alembic upgrade/current | 0001 (head) | Disposable SQLite migration database |
| Docker Compose config --quiet | Passed | Configuration syntax, not running containers |
| Python dependency audit | No known vulnerabilities | 47 scoped project/dev dependencies; urllib3 2.7.0 findings fixed by 2.8.0 |
| npm audit during installation | No reported vulnerabilities | 261 packages |

LAN tests include pairing approval/revocation, unauthorized access, receiver acceptance, binary and zero-byte transfer, duplicate and out-of-order chunks, pause/resume, missing/corrupt chunks, restart recovery, scoped download cookies, cancellation/deletion, expiry/renewal/rate limits and request-size bounds. Browser tests verify actual saved bytes for LAN and encrypted Send Later.

Playwright launches a disposable loopback-only fixture with a known test credential; never deploy that fixture. Cloud test storage is SQLite/local files, not PostgreSQL/S3. Full Chrome launch failed with spawn UNKNOWN; using Playwright's headless shell resolved it. Python socket initialization requires an execution context that permits loopback sockets.

Windows Python 3.14 occasionally emits a Proactor ConnectionResetError callback during browser-context teardown; the tests continue and pass. This is recorded, not suppressed. Production and CI Python 3.12 behavior remains unverified here.

Not verified: physical devices/disconnected networks, mobile browsers, physical camera, trusted TLS, Internet NAT/TURN, containers, actual PostgreSQL/S3 races, disk-full and malicious symlink races, interactive GUI, clean-PC offline runtime or release-grade performance. See RELEASE_READINESS.md; no production-readiness or physical-device claim is made.
