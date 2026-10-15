# Actual Internet acceptance — NOT RUN

Local browser tests are not Internet verification. Record actual assigned HTTPS/WSS URLs only after authorized deployment. Use non-sensitive files and never record participant tokens or TURN secrets.

Device A: PC on broadband/Wi-Fi. Device B: phone on mobile data with Wi-Fi disabled. Record OS/browser/version, network types, file sizes, source and saved SHA-256, elapsed time and selected ICE route. Verify the website also loads from an independent device when the user's personal desktop host is off; no LAN host process should be needed.

| Step | Required acceptance | Current result |
|---|---|---|
| Availability | HTTPS frontend and WSS signaling reachable independently of personal PC; honest cold-start and retry behavior | NOT RUN |
| Create/join | PC creates random temporary room; phone joins via actual QR camera/link/code | NOT RUN |
| Approval | Phone cannot transfer until owner approval; each offer separately accepted | NOT RUN |
| PC → phone | Saved file matches source bytes/SHA-256 | NOT RUN |
| Phone → PC | Saved file matches source bytes/SHA-256 | NOT RUN |
| Text/links/code | Both directions display exact content safely | NOT RUN |
| Multiple/folder files | Each selected file arrives; folder hierarchy limitation explained | NOT RUN |
| Large file | Stream a larger file within browser/storage limits; measure progress/memory and saved SHA-256 | NOT RUN |
| Cancel/corruption | Cancelled/invalid streams fail and are never reported as verified success; partial downloads may need user cleanup | NOT RUN |
| Reconnect/refresh | Rejoin surviving room and resend interrupted file; restart/expired room reports need for a fresh room | NOT RUN |
| Restrictive network | Report direct failure honestly; successful TURN relay requires allocated candidates AND completed byte-verified file | BLOCKED without authenticated public relay |
| Revocation/privacy | End room closes/rejects further sessions; another tab/session cannot access history/capabilities | NOT RUN |

Repeat LAN physical acceptance and clean Windows checks separately for the new desktop artifact. The user's successful prior LAN phone test does not establish new-build or Internet acceptance. Publish a signed-off result only when these actual device/network checks occur; leave failures and blockers explicit.
