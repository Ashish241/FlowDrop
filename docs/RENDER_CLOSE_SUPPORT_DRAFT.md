# Render support case — submitted 2026-10-18

Subject: Server-initiated WebSocket close completes at Uvicorn but public client receives 1006

Service: flowdrop-signaling (existing Free service)
Service ID: srv-db8it65g1s2s73e0q5qg
Public signaling: https://flowdrop-signaling.onrender.com/signal
Current source: 1c4d7e4a1b3da92dc14ff2eb1eb8777e73de5a34
Current deployment: dep-dbad6sfbtjjs73emv6lg
Date: October 18, 2026; times below Asia/Kolkata (UTC+05:30).

Please help investigate why an origin-initiated WebSocket close frame is not observed on the public path. We are not asking to change the plan, enable billing, provision resources, or disable TLS/security.

Observed on the current deployment:

```
19:41:56 INFO: Signaling close requested code=4003
19:42:06 INFO: connection closed
19:42:06 INFO: Signaling close completed code=4003
```

The public Python client received the preceding JSON removed event, then raised ConnectionClosedError with no received close frame (1006). Earlier tests also reproduced this in Chromium, with and without permessage-deflate in Python, and on an accepted connection closed after an invalid token. A separate client-initiated 4003 close observed 4003 in return; we do not count that as server-initiated success.

Both installed Uvicorn transports pass a real TCP local regression against the exact mounted public ASGI target: authenticated room, join, connect, remove, explicit removed event, actual received 4003 frame and revoked credential HTTP 403. Full backend suite: 91 passed, seven unrelated infrastructure skips.

Runtime/configuration: Python 3.14.8 on Render; FastAPI 0.139.2, Uvicorn 0.51.0, websockets 16.1.1. One worker, explicit --ws websockets, host 0.0.0.0, port $PORT, no access log, no proxy headers, WebSocket frame limit 65536, concurrency limit 256. Origin is restricted to https://flowdrop-online.pages.dev. TLS verification remains enabled. An earlier application deadline canceled the close after ten seconds; allowing thirty seconds removed that cancellation, but the actual public close-frame gate still fails. The latest origin log completes rather than reporting cancellation.

The response headers identify server: cloudflare and x-render-origin-server: uvicorn. We cannot establish from these headers whether the cause is the Render edge, another intermediary, or a connection-specific issue.

Reproduction (disposable room only):
1. POST /signal/v2/rooms with an Origin header and a short device name.
2. POST /signal/v2/rooms/{code}/join for a second disposable member.
3. Open WSS /signal/v2/rooms/{room}/ws; send the returned membership token as the first frame. Tokens are never in URLs or logs.
4. DELETE /signal/v2/rooms/{room}/members/{member} using the creator's Authorization: Bearer header.
5. Receive the JSON removed event, then await an actual close frame. Origin requests/completes 4003, public client sees 1006.
6. Clean up the disposable room using the creator's membership DELETE route.

Repository regression: tests/test_public_transport.py. Strict gate is unchanged; we do not accept a timeout or 1006 as successful closing. Please advise on a supported way to preserve origin close frames through this existing Free service. We have not deployed alternate services or changed our account permissions.

This draft contains only public endpoints, service/deployment/commit identifiers, sanitized log lines and reproduction steps. No token, password, file contents, room identity or user transfer data is included.


## Submission status

The user explicitly authorized submission. Sent through the existing account's Render Dashboard Contact support messenger on 2026-10-18, approximately 14:14 UTC. The submitted initial text is above (without the original draft header). The conversation displayed Seen and an AI-agent response. The AI response gave general interrupted-connection/reconnection advice, not an investigation finding. A follow-up clarified that the behavior is deterministic on fresh connections without a deployment in progress and requested human investigation within current Hobby/Free access, plus a case/reference ID. No billing, paid support, permission expansion or new resource was authorized. Render subsequently confirmed escalation to its human team and stated that a response will arrive in the dashboard and by email. No case/reference ID was displayed; no human response or provider fix is claimed. Evidence screenshot: `.flowdrop/render-support-escalated.png`.
