# Changelog

## 0.4.0 integrated — INTEGRATED-20261016.1 — 2026-10-16

- Add backward-compatible optical binary frames (64 KiB cap), missing/duplicate tracking, speed controls, image-import camera fallback and integrity-checked reconstruction in both products.
- Add expiring six-digit online pairing across memory and Redis, preserving capabilities/approval, and cooperative pause/resume with verified-only completion progress.
- Add safe text controls, transfer metadata/rate/ETA and the requested website hero; expose Send Later only as Coming Soon in shipping UIs and deny public cloud proxy routes.
- Preserve LAN networking and prior packages; add actual QR/Redis/optical-offline/pairing/transfer regressions. Public Internet and physical camera acceptance remain unverified.

## 0.4.0 — SPLIT-20261015.1 — 2026-10-15

- Separate offline desktop, dedicated online website and minimal public signaling targets while retaining existing transfer code and combined regressions.
- Remove online/cloud resources and navigation from desktop packaging; add responsive online home/sharing/progress/diagnostics/privacy views and supported folder-file selection.
- Prepare Pages/Render free hosting, exact HTTPS/WSS origin/CSP controls, visible cold-start retries and temporary single-worker room-state policy.
- Verify bidirectional/multiple files, text, cancellation, reconnect and corrupted-stream failure; preserve Windows checkpoints and add independent product/CI checks. Public launch and real Internet acceptance remain blocked by authorization/infrastructure.

## 0.3.2 — ONLINE-20261015.1 — 2026-10-15

- Fix packaged Online Sharing targeting an absent local `/signal`: explicit host-authorized HTTPS endpoint settings, bounded health checks, hosted handoff and honest unavailable/errors.
- Add online invitation URL/QR, endpoint-scoped recovery, shared UDP/TCP/TLS ICE configuration with short-lived TURN credentials, relay-only controls and accurate selected-route/failure diagnostics.
- Supply an optional digest-pinned Caddy HTTPS edge, strict proxy identity and coturn public IP/certificate configuration; no public deployment performed.
- Add configuration and separate-browser byte-verified transfer tests; rebuild Windows artifacts and verify native LAN preservation. Internet/physical acceptance and actual browser relay remain blocked; see current verification records.

## 0.3.1 — LAN-20261015.2 — 2026-10-15

- Reproduced a stale 0.3.0 extracted executable without `--lan`; preserve it as an explicitly named checkpoint and identify new packages with build IDs and hash manifests.
- Windows hardware/route/profile inventory, strict physical auto-selection, ambiguity handling, explicit virtual/manual selection and validated adapter preferences.
- Separate loopback host and selected-interface LAN listeners, shared collision-recovered ports, readiness-gated opening, stopped-by-default native controls, QR, diagnostics and restart/rebind.
- Public-profile consent, no automatic firewall/profile mutation, optional user-approved UAC Private/LocalSubnet rule and clear physical-phone verification boundary.

## Offline LAN connectivity fix — 2026-10-15

- Explicit desktop Offline LAN toggle and CLI `--lan`, active private IPv4 selection, optional wildcard bind, and safe loopback default.
- Canonical LAN connection URL and pairing QR independent of dashboard origin; retain same-origin/WebSocket authorization, add exact Host allowlist and disable implicit proxy trust.
- Windows binding/QR/approval regression coverage, rebuilt portable bundle and Private/LocalSubnet firewall guidance. See `docs/LAN_CONNECTIVITY_VERIFICATION.md`.

## 0.3.0 engineering checkpoint — 2026-10-13

- Redis distributed signaling/session authority, atomic membership, expiry/live revocation, cross-instance routing and shared abuse controls.
- Real disposable PostgreSQL/Garage/coturn checks and browser cloud-provider integration; pinned supported manifests and isolated integration CI harness.
- Persistent source queues for LAN/online/encrypted sharing, fair LAN admission, cached-file retry, byte progress, rates/ETA and explicit receiver save reports.
- Fresh-peer renegotiation and serialized signaling after sender/receiver refresh; bounded idempotent backoff and S3 wrapped-error recovery.
- Windows version reporting and graceful-exit diagnostic/smoke; 1 GiB and concurrent loopback HTTP measurements.
- Not a verified public RC: physical, clean-PC, Internet relay/TLS, Docker/remote CI and production security/HA acceptance remain open.

## 0.2.0 development checkpoint — 2026-10-13

- Preserve online sessions during navigation; explicit room refresh/reconnect and correct relay diagnostics.
- Tab-scoped unified online history and encrypted sender management, original-file checked checkpoint retry and upload pause.
- Optional download-session limits, expiring leases and migration 0002.
- Recover LAN assembly disk failures; retryable cloud storage errors, atomic local object writes, upload timeout, bounded abuse controls and explicit proxy trust.
- Regression, internal security review, physical acceptance checklist and rollback documentation. Public release gates remain unmet.

## 0.1.0 — Unreleased

- Implemented authenticated LAN pairing, explicit approval, persistent sessions/chunks, restart resume, native streaming downloads, transfer cancellation and text sharing.
- Added React interface with responsive navigation, QR pairing, pause/resume/reselection, recipient selection and experimental optical text.
- Added independent signaling and real WebRTC file/text transfer with receiver approval and SHA-256 verification.
- Added browser AES-GCM Send Later, encrypted metadata, private-storage adapters, expiry/revocation and initial migration.
- Added Python, Vitest and Playwright tests, CI, Docker configuration and Windows portable build script.

Not a production release. See docs/IMPLEMENTATION_STATUS.md for blockers and actual validation.
