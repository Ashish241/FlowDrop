# FlowDrop 0.4.0 — independent desktop and online website

The starting source checkpoint is `13ec1e7` (0.3.2). The last physically working LAN baseline is user-reported 0.3.1; no new physical-phone verification is implied. The previous 0.3.2 ZIP is preserved at `dist/checkpoints/FlowDrop-0.3.2-online-working.zip`; the 0.3.1 ZIP and existing extracted working folders remain intact.

## Product boundaries

| Target | Entry and build | Runtime |
|---|---|---|
| Desktop Offline LAN | Existing `src/main.tsx`, `npm run build:desktop` → `apps/web/dist-desktop` | Existing native launcher/FastAPI LAN host, explicit LAN opt-in, pairing/approval, physical adapter selection, dual listeners, streaming/resume/queues/text |
| Online website | `src/online-main.tsx`, `npm run build:online` → `apps/web/dist-online` | Static HTTPS site plus independently hosted signaling; no desktop, local host or cloud API calls |
| Public signaling | `services.signaling.public:create_app` | One worker with bounded temporary memory rooms for the free MVP; no database/Redis required. Existing Redis implementation remains available for an explicitly configured multi-worker deployment |
| Combined regression fixture | `npm run build` → `apps/web/dist` | Preserved existing combined development/test interface, including Send Later and optical flows. Not the desktop shipping target |

Vite removes online/cloud modules from the desktop build; this is checked in the actual JavaScript artifacts, not only by hiding buttons. The online build similarly excludes LAN pairing and encrypted cloud upload implementation. Desktop omits the online download worker. The packaging script accepts only `dist-desktop` and maps it to the existing frozen resource path, so LAN runtime architecture is unchanged. Online settings/handoff code remains in source for compatibility but is not wired into the offline launcher. Obsolete online CLI options are removed from that launcher.

Real shared code stays in `apps/web/src`: WebRTC transport, hashing, queues, transfer history, streaming sink, icons and styling. A new package hierarchy would add indirection without additional reuse. The public website has Home, Send/Create Room, Receive/Join Room, Text Sharing, Transfer Progress, Connection Diagnostics and Privacy/Help views. Its active transfer panel remains mounted across navigation. Folder selection sends individual files where supported; it does not recreate directory trees. Browser and memory limits still apply.

## Commands

From `apps/web`, run `npm ci` once, then build/test each target independently:

```powershell
npm run build:desktop
npm run test:desktop
npm run build:online
npm run test:online
```

Each product test command starts only its own loopback fixture. `python -m scripts.check_products` from the repository root checks both built artifact boundaries. `npm run build` and `npx playwright test` retain the combined regression suite. `npm test`, `npm run lint`, `python -m pytest -q`, Ruff and the existing packaging/network smoke commands remain available. Frozen builds bundle no Python signaling service, online URL probe or cloud service dependency.

`python -m scripts.product_host online` serves the static website plus signaling on loopback 8770 for development. `python -m scripts.product_host desktop` serves the offline target on loopback 8771. These are disposable fixtures, not public servers. Use the normal native launcher for desktop operation.

## Online architecture and limits

Two browsers open the static HTTPS website and use its configured HTTPS/WSS signaling endpoint for room metadata, approval, SDP and ICE. Files/text travel over encrypted WebRTC DataChannels, directly or through an authenticated TURN relay. No user's desktop host participates in website operation. A deployed frontend and backend must run on hosting infrastructure independently of the user's PC.

The free MVP uses one signaling worker and temporary in-memory room state. Room IDs/credentials are cryptographically random, receiver approval and per-file acceptance are retained, rooms expire after one hour, HTTP/WebSocket rates and frame/room limits remain enforced, and file messages are not forwarded by signaling. Restart or free-service spin-down erases rooms; users must create a fresh room if reconnect reports expired/unavailable. No persistent database is required. Do not add workers without shared Redis authority.

The website waits up to 70 seconds while signaling wakes, then gives a visible retry/error state. A reachable health endpoint is labeled signaling readiness, never an always-connected peer indicator. The sharing controls display actual ICE/DataChannel status and selected Direct P2P/TURN route. Public builds can use a reviewed, build-time cross-origin HTTPS signaling endpoint; generated Pages CSP permits only that exact HTTPS/WSS origin and the backend requires exact authorized website origins. No wildcard CORS, mixed-content exception or browser credential embedded in a URL is added.

The initial deployment can be direct-P2P-first using configured STUN. STUN does not guarantee traversal of symmetric NATs or restrictive networks. Without an operator-authorized authenticated TURN service some users cannot connect; the UI says so. Existing short-lived coturn credential support and relay-only diagnostics remain. Long-term TURN secrets never enter public JavaScript.

### Previous coturn failure investigation

The 0.3.2 loopback WSL fixture authenticated both peers, allocated candidates and created permissions, but logged `udp send: Operation not permitted`; browser ICE failed. Inspection of coturn 4.18.0 `src/apps/relay/ns_ioalib_engine_impl.c` identifies this message in the UDP forwarding path after the socket send returns an error, separately from allocation/permission rejection. A basic WSL UDP loopback probe previously passed. This narrows the failure to the relay forwarding path; it does not prove all UDP is blocked or establish the exact host/kernel policy responsible.

No firewall/profile, WSL system setting or production private-peer ACL was weakened. No new successful relay or Internet result is claimed. The positive relay fixture remains opt-in and blocked pending an appropriate reachable relay environment. Public TURN UDP/TCP/TLS and actual relayed file acceptance remain external gates.

See [free deployment instructions](FREE_HOSTING.md), [current verification](SPLIT_VERIFICATION.md) and [Internet acceptance](INTERNET_ACCEPTANCE.md). This checkpoint is not production-secure or Internet-verified solely because local tests pass.
