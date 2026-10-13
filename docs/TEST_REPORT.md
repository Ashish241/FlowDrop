# v0.2.0 verification record

Final aggregate browser run: **12 passed in 29.4 seconds**, including actual saved-byte checks, encrypted upload interruption/reload/reselection, secret-link refresh, WebRTC navigation/refresh/rejoin/text, multi-client privacy, accessibility and responsive layouts. Portable Windows build and smoke passed (help, API, compiled frontend and worker from outside checkout); ZIP was generated only after smoke success. Physical clean-machine and GUI tests remain NOT VERIFIED.

After the final pause/revocation UI correction, ESLint/strict build passed and both affected browser tests passed (2/2). Final Ruff and Pytest (21/21) passed. Packaging was rebuilt and smoked again. Archive: `dist/FlowDrop-windows.zip`, 25,219,785 bytes, SHA-256 `E1CD5C70A698066BC0285BD7A3A3EFDDE34137159C4EA683BA9F1B566DBF77F6`. Preserved prior archive hash matches `23B26DA0D40990295F46E9C9C4146A78211EC7889688372AD13F4BCDDF0B1B89`.

Date: 2026-10-13. Baseline commit: `780ed3f57a0f80558b038626904122e83c49070c`. Git status was clean before edits. Baseline rerun: Pytest 16, Vitest 7, Playwright 11 passed.

Current backend: 21 Pytest passed. Added assembly disk-full retry without restart, object-store write failure/retry, sender-only upload checkpoints, download session limits/revocation, trusted-proxy spoofing and bounded limiter capacity tests. Ruff passed.

Frontend: Vitest 7 passed, strict TypeScript/Vite and ESLint passed. Browser regression initially passed 11 tests after recovery/navigation changes. Expanded 12-test run passed 11 and failed a test selector that matched two delivered text messages; correcting it produced a passing focused WebRTC test including navigation and peer refresh/reconnect. Interrupted encrypted upload/reselect validation passed in that expanded run. Final aggregate run and Windows packaging results will be appended after execution.

Alembic upgraded the existing disposable SQLite migration database from 0001 to 0002 (head). Real PostgreSQL remains unverified. Docker info failed because `dockerDesktopLinuxEngine` named pipe does not exist; no container integration was executed.

Fresh npm audit: zero vulnerabilities in 261 packages. Fresh Python pip-audit: no known vulnerabilities in the 47 pinned dependency closure; lock has no artifact hashes. These are dependency database checks, not security certification.

Warnings: upstream Starlette/httpx deprecation; occasional Windows Python 3.14 Proactor connection-reset callback on browser teardown. Recorded without suppressing failures. No physical device, clean-machine, Internet/TURN or real cloud storage evidence is claimed.
