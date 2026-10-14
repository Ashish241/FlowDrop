# FlowDrop

**Share anything. Anywhere. Even offline.**

FlowDrop is under active implementation. Working browser-tested flows include approved LAN file/text sharing, resumable chunk uploads, native streamed downloads, WebRTC file/text sharing, and browser-encrypted Send Later through the development storage adapter. Optical text sharing is experimental. No account is required.

Current engineering checkpoint: **0.3.0**. Redis-backed signaling/rate controls, persisted file queues, fair LAN scheduling and dashboard analytics are implemented. Real PostgreSQL, S3-compatible storage and coturn allocation tests passed locally. See [verification record](docs/TEST_REPORT.md), [infrastructure evidence](docs/INFRASTRUCTURE_VERIFICATION.md), [known limitations](docs/KNOWN_LIMITATIONS.md), [release gates](docs/RELEASE_READINESS.md) and [rollback](docs/ROLLBACK.md). Cloud databases require Alembic migration 0002. Source files can be retained in browser IndexedDB for recovery; secret capabilities remain tab-scoped. **Not a verified public release candidate or production release.**

## Run locally

```powershell
python -m pip install -e ".[dev,cloud]"
cd apps/web
npm ci
npm run build
cd ../..
python -m apps.desktop.launcher
```

The launcher opens native host controls and a browser dashboard. Stop the initial loopback host, check **Enable Offline LAN sharing**, select the Wi-Fi/Ethernet/hotspot adapter used by your phones, and start the host. Use the displayed URL/port on other devices. Enter the code or scan the QR, wait for host approval, choose a recipient and have the recipient accept each offer. The host remains running for all LAN transfers, including mobile to mobile. CLI mode supports --lan, explicit --bind and --port; see docs/OFFLINE_LAN_GUIDE.md.

Use a trusted private network: default LAN HTTP is **not encrypted**. Optional trusted-certificate TLS is configurable. Do not expose the LAN host to the internet. LAN uploads, assembly and native downloads use bounded buffers. Secure browsers stream WebRTC and decrypted Send Later downloads; unsupported browsers have a 128 MiB fallback limit. Very large physical-device transfers remain unverified.

## Validation

```powershell
python -m unittest discover -s tests -v
cd apps/web
npm run build
```

See [implementation status](docs/IMPLEMENTATION_STATUS.md) and [test report](docs/TESTING.md) for actual results and remaining requirements. External TURN, PostgreSQL/S3 containers, physical devices/camera and a clean Windows target remain unverified. This is not a production release. See docs/DEVELOPMENT.md to run the integrated loopback development host and docs/DEPLOYMENT.md for infrastructure configuration.
