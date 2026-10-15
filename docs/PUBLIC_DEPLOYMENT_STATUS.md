# Public deployment execution — 2026-10-16

Source checkpoint `c47cc16fd4896e2091040403b63298451786b786` pushed to the existing private `Ashish241/FlowDrop` repository, branch `master`, with explicit owner authorization. Actions was temporarily disabled for this push and restored to its original enabled/all-actions/no-SHA-pinning settings. No CI run was triggered. No repository or release was replaced.

## Assigned services

- Render Free: https://flowdrop-signaling.onrender.com
- Signaling base: https://flowdrop-signaling.onrender.com/signal
- Render service: `srv-db8it65g1s2s73e0q5qg`; first deploy `dep-db8it6lg1s2s73e0q6t0` from `c47cc16`.
- Cloudflare Pages project: `flowdrop-online`; assigned origin https://flowdrop-online.pages.dev. Production deployed successfully by Direct Upload (no Git integration). Deployment `a58697d1-bd04-48dc-bdd8-dddcd67a9de4`; Pages production branch label `main` is upload metadata, while source checkpoint is repository `master` at `c47cc16`. Use the canonical origin, not the deployment-specific preview hostname, for signaling CORS.

Render uses the owner's confirmed My Workspace, Python 3, Free 512 MB / 0.1 CPU, one uvicorn worker, no proxy-header trust, bounded frame/concurrency settings, health `/signal/health`, auto-deploy Off, exact Pages origin, Cloudflare STUN and ICE policy all. No Redis/database/S3/TURN credentials, billing change, paid compute, custom domain or new repository was added.

## Actual checks executed

- Public HTTPS `/signal/health`: 200, signaling protocol 1, STUN true, TURN false.
- Public authenticated WSS: temporary owner room, six-digit join, pending receiver and owner approval passed; temporary room revoked afterward. No tokens/codes saved.
- Public exact-origin preflight passed; untrusted Origin room creation returned 403.
- Public `/api/health` and `/cloud/health`: 404, preserving backend separation.
- Real production `npm run build:pages`: TypeScript and Vite passed with assigned Render endpoint; generated metadata and exact HTTPS/WSS CSP passed; bundle local URL literal scan passed.
- Upload artifact `.flowdrop/FlowDrop-pages-production.zip` contains static site files at archive root. It was uploaded and deployed after the owner enabled the required browser extension permission.
- Windows ZIP unchanged: SHA-256 `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`.

- Public deployment verifier passed on the actual Pages/Render endpoints: frontend assets/configuration, exact HTTPS/WSS CSP, local-URL literal scan, health, CORS, authenticated WebSockets, six-digit join, owner approval and synthetic metadata routing. Evidence `.flowdrop/public-verification.json`; no physical cross-network claim.
- Actual rendered Edge website: homepage/Optical Share/Send Later Coming Soon visible; room created, receiver joined via six-digit code, owner approval and Direct P2P connection succeeded.
- Text and one synthetic 65,536-byte file transferred between two Edge tabs on this same PC using the deployed website/backend. Receiver reported SHA-256 verified; saved Downloads/public-smoke.bin hash independently matched source: `7DACA2095D0438260FA849183DFC67FAA459FDF4936E1BC91EEC6B281B27E4C2`. This is real WebRTC with hosted signaling but same-PC peers, not different-network/device acceptance.
- Browser download-event observation timed out; the file was nevertheless saved and its hash checked directly. A full-page screenshot attempt timed out; viewport screenshot captured separately. The test room was ended afterward.

## Pending gates

Physical cross-network PC/phone transfer, mobile saved-file behavior and long-lived/cold-start recovery acceptance remain open. No physical cross-network PC/phone or TURN relay success is claimed. Render Free sleep/restarts lose memory rooms; STUN alone cannot traverse every NAT/firewall. Shared proxy rate aggregation remains a preview capacity limit. Existing local automated and desktop regression evidence is in PUBLIC_DEPLOYMENT_READINESS.md.
