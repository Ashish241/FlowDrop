# Public WebSocket close investigation — 2026-10-18

The release gate remains unchanged: host removal must revoke credentials, deliver the explicit removed event, and yield an actual received close frame with code 4003. Timeout or abnormal closure 1006 is a failure. Client-initiated close is a separate diagnostic, not a substitute for this gate.

## Controlled comparisons

- Rechecking deployed source 4257560 still failed the strict public gate.
- A separate authenticated disposable public connection initiated close 4003 from the client and observed close code 4003 in return. This proves only that diagnostic direction; it does not prove correct origin-initiated closing.
- New real-TCP regression tests launch the mounted public ASGI application on an ephemeral loopback port with both installed Uvicorn transports (`auto` and `websockets`). Each requires an actual server-initiated 4003 frame and revoked-credential HTTP 403. Both passed. These are local network tests, not physical or Internet acceptance.
- Privacy tests verify close logging excludes payload, reason and exception contents. Only numeric code, lifecycle and exception class are emitted; existing transport logs are otherwise unchanged.
- Full backend checks: 91 passed, seven unavailable-infrastructure skips, Ruff passed.

## Public instrumentation

Source `1f2fe7481d922393d285b20398ec6a606ec77691` was manually deployed to the existing Render Free service, deployment `dep-dbad5lmq1p3s73b7er90`, successful in 41.5 seconds. Strict public verification still failed. Sanitized server logs showed:

```
19:39:26 Signaling close requested code=4003
19:39:36 Signaling close failed code=4003 exception=CancelledError
```

This identifies an application cancellation at the original ten-second deadline. It does not independently prove that cancellation is the only cause of close-frame loss. The installed transport performs multiple bounded closing phases and discourages cancellation; see the installed `websockets.legacy.protocol.WebSocketCommonProtocol.close` implementation.

## Correction under verification

Source `1c4d7e4a1b3da92dc14ff2eb1eb8777e73de5a34` allows the existing transport up to thirty seconds before cancellation, so it can complete its own handshake/TCP shutdown rather than being canceled at the first-phase deadline. Membership still revokes before awaiting closure. Origin checks, single worker, rate limits, message limits and strict 4003 verification remain unchanged. Full backend suite passed again (91 passed, seven skips, 4.65 seconds). The actual public retest result must be recorded before frontend release.

## Hosting constraints and references

The observed public HTTP headers identify Cloudflare at the edge and Uvicorn at the origin. Those headers do not establish a provider bug. No changes to TLS verification, authentication, firewall, accounts, paid resources or infrastructure topology are made. Render's documentation describes graceful WebSocket closing and reconnect handling: https://render.com/docs/websocket . The existing Free account, service and paused automatic deployment remain in use.

The UI polish checkpoint bf7d8f5 remains ready locally (23 Online, eight LAN browser tests, 31 frontend units), but is not publicly deployed while the mandatory close gate is unresolved. Physical device/TURN limitations remain unchanged.


## Final current-deployment result

Deployment `dep-dbad6sfbtjjs73emv6lg` (source `1c4d7e4`) succeeded manually in 39.7 seconds. The unchanged strict public gate failed again. Origin logs show close requested at 19:41:56 and completed with code 4003 at 19:42:06 (Asia/Kolkata), without CancelledError. The Python client still reported no received frame (1006). The thirty-second bound removes the observed premature cancellation, but does not solve the public frame-loss issue; it is not claimed as the root-cause fix.

The sanitized case in `RENDER_CLOSE_SUPPORT_DRAFT.md` was submitted after explicit user approval. An initial AI response gave generic reconnection advice; a follow-up requests human investigation without paid changes. New services, paid upgrades and security weakening are not proposed. Latest UI remains withheld, rollback artifacts unchanged.

Render confirmed human-team escalation in the account messenger after the approved submission. A human reply is pending; no case ID was displayed. The strict release gate is still failed.
