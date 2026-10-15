# Current Online Web workflow

Open the independent hosted website (or explicit loopback development preview), choose Send, then Create room. Share the six-digit code (valid 10 minutes), QR or invitation. The receiver chooses Receive, enters the code/invitation and joins. Approve the receiver, select files or supported folder contents and accept each offer. Text/code/links use Share Text with safe copy/clear controls. Pause/resume is cooperative within the same connected session; in-flight chunks may settle. Interrupted transfers are resent after reconnect. Use Optical Share independently once its assets are loaded; Send Later is Coming Soon only. The offline desktop never hosts the public online service.

Deployment remains governed by FREE_HOSTING.md and requires explicit approval and real service URLs. No Internet success is implied by local preview. Current verification is INTEGRATED_VERIFICATION.md.

# Integrated 0.4.0 — INTEGRATED-20261016.1

Current source starts at `b1a3ec2`; the earlier split and working LAN checkpoints are preserved. Desktop and Web now both expose Optical Share and Send Later — Coming Soon. Online adds six-digit temporary codes (10-minute TTL), existing strong room IDs/capabilities and owner approval, cooperative in-session pause/resume, safe text copy/clear/history controls, transfer metadata and measured speed/ETA. Progress stays below 100% until integrity verification. Interrupted WebRTC files still require whole-file resend; in-flight chunks may settle after pause. Resume on the device that paused.

Optical version-1 text remains compatible and version-2 supports files up to 64 KiB. The same QR decoder accepts camera frames or imported images and supports repeated, missing, duplicate and out-of-order frames. Existing offline LAN routing, pairing, resume and firewall/adapter logic are unchanged. See [Optical guide](OPTICAL_SHARING_GUIDE.md) and [current verification](INTEGRATED_VERIFICATION.md).

Send Later is a visible non-upload Coming Soon screen in shipping builds. No cloud API is called by that screen, no new database/storage/payment dependency is added, and the public Nginx `/cloud/` route returns 404. Legacy implementation and its explicitly local combined regression host are retained; it is not part of the shipping website/desktop feature set. No cloud service was deployed.

Public deployment and Internet/TURN/physical-device verification remain open. No push, publication, public deployment or expenses were authorized or performed.

---

# Historical pre-split setup — not current desktop instructions

# Online Sharing — 0.3.2

Offline LAN continues to run independently of Internet services. Online Sharing uses a public HTTPS website, its same-origin `/signal` HTTP/WSS proxy, Redis-backed signaling, and encrypted WebRTC DataChannels. Direct connections use STUN; restrictive networks need an authenticated TURN relay. File bytes travel between browsers directly or through TURN, not through the signaling service. Send Later retains its separate encrypted storage path.

## Desktop setup

Open the local host dashboard, select Online Sharing, and enter the operator's public HTTPS website and signaling URL (normally `https://<owned-domain>/signal`). Save from the authenticated host dashboard. Settings are stored in `%LOCALAPPDATA%/FlowDrop/online.json`; environment variables `FLOWDROP_ONLINE_URL` and `FLOWDROP_SIGNAL_URL` override them. Equivalent launcher flags are `--online-url` and `--signal-url`. These values contain URLs, never TURN shared secrets or LAN capabilities.

The launcher checks signaling health and that the website serves FlowDrop and exposes `/signal/health`. It does not follow redirects or accept public HTTP. Click **Open hosted Online Share** after the check succeeds. A new hosted tab opens without a referrer or LAN host token. Standalone users can open the public site directly. No public service is bundled or silently provisioned.

Without configuration the exact message is **Online Sharing is unavailable: signaling server not configured.** An unreachable or invalid service produces an explicit error and retry controls. The desktop does not attempt local `/signal` or offer unusable rooms. Saving an empty website disables the handoff. Loopback/LAN addresses are rejected for public online settings.

On the hosted site, create a room, share the invitation link/QR, and approve the joining browser. Invitees can also enter the room ID. Invitations contain the room ID only; they grant no owner capability. The recipient accepts each file offer. Both peers can send files, multiple files, text and URLs. Keep both tabs open; a room lasts one hour. Reconnect/retry restarts an interrupted file rather than resuming arbitrary byte offsets. Source recovery depends on browser storage quota; reselect may be necessary. Browser streaming support and the existing 128 MiB fallback limit still apply.

The route indicator reports the selected ICE pair as Direct P2P or TURN relay. **Relay-only** requires configured authenticated TURN and never falls back silently. A configured server is not proof of relay connectivity: allocation and connectivity errors are displayed separately. Short-lived TURN credentials are fetched by an authorized room participant, never embedded in the frontend.

## Approved public deployment

The repository supplies `compose.online.yaml`, an optional Caddy HTTPS edge overlay for `compose.yaml`. It has been syntax-checked; containers and Internet deployment have **not** been run. Obtain deployment authorization, an owned DNS name, a public server, and required credentials first. Review the existing deployment/security documents, storage configuration and quotas. Do not expose the desktop LAN server publicly.

Prepare `.env` from `.env.example` privately, with strong PostgreSQL/Redis/Garage/S3 values and `FLOWDROP_DOMAIN`. Point DNS at the server; allow HTTP 80 for certificate issuance and HTTPS 443. Supply `TURN_REALM`, a random `TURN_SECRET` of at least 32 characters, and public STUN/TURN URL arrays, for example:

```dotenv
FLOWDROP_STUN_URLS=["stun:turn.your-owned-domain.example:3478"]
FLOWDROP_TURN_URLS=["turn:turn.your-owned-domain.example:3478?transport=udp","turn:turn.your-owned-domain.example:3478?transport=tcp"]
FLOWDROP_ICE_POLICY=all
```

Replace example DNS with the owned relay hostname. TURN URLs and secret must be configured together; leave both empty to run without TURN. Set `FLOWDROP_ICE_POLICY=relay` only when authenticated TURN is ready. Set `TURN_EXTERNAL_IP` to the real public IPv4 or coturn `public/private` mapping when NAT/container addressing requires it. Forward/allow UDP and TCP 3478 and UDP relay ports 49160–49200. UDP relay egress must work even when clients connect to TURN over TCP.

For TURN TLS, put operator-managed certificates under ignored `infrastructure/coturn/certs`, set `TURN_TLS_CERT` and `TURN_TLS_KEY` to their `/run/flowdrop-turn-certs/...` paths, add a `turns:<owned-host>:5349?transport=tcp` URL, and allow TCP 5349. Both certificate files are required and must remain valid/renewed. Caddy's website certificate is not automatically shared with coturn. Production coturn denies private/loopback peers; never deploy the permissive test-only browser fixture.

The overlay reserves backend `172.31.251.0/24` and edge `172.31.252.0/29`. Check route conflicts first; if changed, update the fixed addresses and matching proxy trust entries together. Only Caddy `172.31.252.2` can supply client identity to Nginx, and only Nginx `172.31.251.2/32` is trusted by the APIs. Caddy replaces incoming forwarded identity; Nginx forwards the resolved client address. Do not broaden trust to arbitrary proxies. The edge enables one-year HSTS, so verify domain/TLS ownership before use. The base stack retains loopback-only port 8080; API, Redis, database and S3 ports remain private.

After authorization and configuration, the operator command is:

```powershell
docker compose -f compose.yaml -f compose.online.yaml --profile turn up -d --build
```

This command was **not executed** for this change. Verify public `/signal/health`, HTTPS certificates, WSS upgrade, Redis room routing/revocation, actual client rate identity, storage health, and TURN UDP/TCP/TLS allocation. Then transfer and byte-verify files in both directions between devices on different Internet networks; repeat with relay-only and confirm selected relay candidates. Test expiration, cancellation, browser refresh/reconnect, large streams and mobile saves. A green health endpoint alone does not pass these gates.

## Local development only

Build the frontend and run `python -m scripts.dev_host` on loopback. Start a separate desktop process with `--online-dev --online-url http://127.0.0.1:8000 --signal-url http://127.0.0.1:8000/signal` (adjust ports if needed). This explicit exception permits loopback HTTP only and is labeled development in the UI. It is not an Internet service and cannot provide cross-network acceptance evidence. Keep the default public configuration strict.

See [verification and blockers](ONLINE_SHARING_VERIFICATION.md) and [physical acceptance](PHYSICAL_ACCEPTANCE.md). No physical-phone or Internet test is implied by local browser automation.
