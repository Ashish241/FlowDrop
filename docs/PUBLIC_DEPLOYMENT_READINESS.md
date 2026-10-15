# Public deployment completed — 2026-10-16

Website: https://flowdrop-online.pages.dev. Signaling: https://flowdrop-signaling.onrender.com/signal. Deployed with explicit authorization on Pages Direct Upload and Render Free; Git auto-deployment off. Public HTTP/WSS/security/room checks passed, as did deployed-site text and a saved hash-matched 64 KiB WebRTC file between two tabs on the same PC. Physical cross-network transfers and TURN remain unverified. Windows ZIP unchanged. See [actual deployment evidence and limitations](PUBLIC_DEPLOYMENT_STATUS.md). The preparation record below is historical.

---

# Public Online deployment checkpoint — 2026-10-16

Starting commit: `463620c`. Public website URL: **not assigned**. Public signaling URL: **not assigned**. Status: **deployment awaiting explicit owner authorization and hosting access; Internet acceptance not verified**.

## Implemented and verified locally

Added `npm run build:pages`, which requires an actual public HTTPS DNS signaling endpoint at `/signal`, rejects local/private IP literals and placeholder domains, and normalizes the endpoint. Online builds emit public configuration metadata and retain exact HTTPS/WSS CSP destinations. No credentials belong in `VITE_*`. The ordinary same-origin online artifact remains available for local/proxy use and must not be uploaded unconfigured to Pages.

Added `scripts/verify_online_deployment.py` for assigned public URLs. It checks the website, build metadata/CSP, bundle local URL literals, signaling health, CORS, authenticated WebSockets, six-digit room joining, receiver approval and synthetic SDP routing, then revokes its temporary room. It records no pairing codes, tokens, SDP/ICE or TURN credentials. It does not transfer files or establish a real peer connection.

| Check executed for this checkpoint | Actual result |
|---|---|
| Backend Pytest | 77 passed; 7 unconfigured provider integrations skipped |
| Frontend Vitest | 13 passed, including two deployment configuration tests |
| Ruff / ESLint / strict TypeScript / online production build | Passed |
| Guarded Pages build without endpoint | Rejected as intended |
| Isolated Pages fixture build | Passed; normalized endpoint, exact HTTPS/WSS CSP and local-URL scan checked; fixture is not a deployed service |
| Online product browser suite | 5 passed: local WebRTC, transfer controls/integrity, optical QR import, layout/accessibility |
| Desktop product browser suite | 8 passed: offline resources, LAN URLs/QR, pairing and transfers |
| Deployment verifier against localhost:8770 | Passed HTTP/WS, exact origin, room join/approval and synthetic metadata; local harness only |
| Existing packaged executable `--panel-smoke` | Passed native QR, authenticated 256 KiB hash-matched LAN download/socket, restart/shutdown; clients on same PC |

Windows ZIP and executable were not rebuilt. `dist/FlowDrop-windows.zip` remains SHA-256 `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`. Offline LAN code and architecture are unchanged. Existing checkpoint remains in Git history. Local verifier evidence is `.flowdrop/deployment-verifier-local.json`; native diagnostic logs are `.flowdrop/deployment-desktop-regression/`. These local generated files are ignored, not public release evidence.

## Reviewable deployment settings and procedure

Follow [FREE_HOSTING.md](FREE_HOSTING.md), including creating an empty Pages project first to obtain the exact allowed origin, then Render Free, then the guarded frontend build/upload. Proposed logical names are `flowdrop-online` and `flowdrop-signaling`; availability and assigned URLs have not been checked. Keep automatic deployment off. Use existing `render.yaml`, one worker, `/signal/health`, exact `FLOWDROP_ORIGINS`, Cloudflare STUN and ICE policy `all`. Leave Redis, database/S3 and TURN credentials unset for the free direct-first preview. No account login, push, resource creation or deployment has occurred. Hosting CLI credentials were not supplied or inspected; use an authorized account/session after approval, not secrets pasted into chat.

This is a single stateful in-memory signaling service. Render Free sleep/restart destroys rooms; refresh and pair again. Reconnection and whole-file resend are available, not durable byte-level recovery across server loss. Rate limits remain bounded; ignored forwarded IPs can aggregate clients behind the provider proxy. Only enable trusted proxy handling using verified provider addresses, never unrestricted forwarded headers. Free quotas/cold starts and that shared-proxy constraint limit availability/capacity; do not enable chargeable overages.

Normal online file/text payloads continue over WebRTC; signaling carries room control and SDP/ICE metadata. Existing six-digit/QR invitations, owner approval, multiple files, pause/resume, cancel and integrity checks remain covered by local tests. Optical Share stays enabled; Send Later stays Coming Soon. No file upload/storage backend was added.

## External gates still open

- Explicit authorization for any required Git push and Cloudflare Pages / Render Free deployment, plus access to the intended accounts/projects. No paid resources or public publication is authorized yet.
- Actual HTTPS URL, WSS service, cold-start/restart behavior, untrusted-origin refusal, deployed rate limits and public browser WebRTC checks after deployment. The verifier must be rerun on assigned URLs; local results do not satisfy this gate.
- Physical PC-to-phone and phone-to-PC across different networks, real saved-file hashes, mobile lifecycle and independent-of-host-PC website access. No physical device or real Internet transfer was tested.
- TURN credentials and successful relay acceptance. STUN is configured; TURN is absent and relay success is not claimed. Some NAT/firewall combinations will fail without TURN.
- Clean Windows installation and physical camera/network acceptance remain external gates in [INTERNET_ACCEPTANCE.md](INTERNET_ACCEPTANCE.md) and [PHYSICAL_ACCEPTANCE.md](PHYSICAL_ACCEPTANCE.md).

No production-readiness claim is made. Existing provider/container results are historical unless explicitly rerun above; the seven skipped provider cases remain unavailable in this run. Expected upstream TestClient and Windows socket teardown warnings do not represent physical-network evidence.
