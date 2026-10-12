# WebRTC

Choose Online Share. Create a temporary room and send its invitation code to the other device. The receiver joins; the owner approves membership. File selection sends metadata over the DataChannel. The receiver separately accepts each file. Sender reads 64 KiB file slices and waits for bufferedAmount backpressure. The receiver verifies SHA-256 before exposing its Save action. Text uses the same DataChannel and is rendered as text.

The signaling service exchanges SDP and ICE only. Room credentials are sent as the first WebSocket frame rather than query strings; sensitive fields are not logged. Rooms expire after one hour. ICE configuration requires a room capability. Optional TURN credentials are short-lived HMAC credentials compatible with coturn REST authentication.

Secure browsers with Service Worker support stream native downloads, with a configured file ceiling of 20 GiB. A cumulative acknowledgement window bounds sender outstanding bytes to 1 MiB, while a 2 MiB receive queue rejects flooding. Unsupported browsers use a 128 MiB buffered fallback. Multiple selected files are sent sequentially with separate receiver approval. Real Chromium testing verified 2 MiB + 17 byte and zero-byte streamed downloads. This does not verify a 20 GiB physical-device transfer.

Interrupted online transfers require a new room/resend. Browser-refresh session recovery, bidirectional queue orchestration, and persistent online transfer history remain unfinished. Navigating away from the Online Share panel disconnects its current peer; keep the panel open during a transfer.

Actual Chromium-to-Chromium file/text and saved-byte checks passed on loopback with empty ICE-server configuration. This verifies real DataChannels, not Internet NAT traversal. External direct P2P and TURN relay tests remain pending. Configure ICE services for Internet use; direct connections are not guaranteed on every network.

WebRTC encrypts payload transport. A TURN relay forwards encrypted transport packets and sees traffic endpoints/volume. Signaling observes room membership and connection negotiation, not ordinary file bytes. Select a relay candidate in getStats to distinguish relay from direct connectivity; UI route classification needs additional complex-network tests.
