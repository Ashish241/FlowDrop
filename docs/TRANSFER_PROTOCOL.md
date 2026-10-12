# LAN protocol v0.1

1. Client submits code and device name to `POST /api/pair`. It receives an unapproved capability.
2. Host uses `POST /api/devices/{id}/approve`.
3. Every protected HTTP request supplies `Authorization: Bearer <capability>`.
4. Sender offers filename, size, recipient ID, and SHA-256 to `POST /api/transfers`.
5. Recipient uses `POST /api/transfers/{id}/accept`.
6. Sender uses the negotiated chunk_size (1, 2 or 4 MiB) at `PUT /api/transfers/{id}/chunks/{index}`. Last chunk has the exact remaining count. Duplicate bytes are accepted; conflicting duplicate digests are rejected. Chunk order is unrestricted. `GET /api/transfers/{id}` returns completed indexes to the sender; ordinary listings omit chunk maps to keep progress polling small.
7. Sender calls `/finish`. Missing chunks are rejected. Assembly uses 64 KiB reads and SHA-256 verification. Empty files require no chunks.
8. Recipient obtains a scoped HttpOnly SameSite download cookie through authenticated `/download-ticket`, then starts a native `/download`. Credentials do not appear in download URLs. Header-authenticated API downloads remain supported.
9. Either participant cancels using DELETE; stored payloads are removed.

States implemented: PENDING → ACCEPTED → TRANSFERRING ↔ PAUSED → VERIFYING → COMPLETED or FAILED. Participants may cancel. Expiry cleanup removes files/metadata after 24 hours. COMPLETED means the hosted payload passed verification and is available to save; the browser manages receiver download progress and disk persistence.

WebSocket `/api/ws` receives the capability as its first frame within five seconds. Subsequent text messages contain `type: text`, `recipient`, and `text` (maximum 65,536 characters). Text is rendered as text, never HTML. A refresh notification asks the client to reload authorized metadata.

Session capability hashes and chunk metadata survive restart for their original lifetime. The host receives a fresh administrative capability with the same host identity. Browser refresh requires reselecting the original file; size and hash must match. New chunk-size configuration does not change an existing transfer's negotiated size.

WebRTC uses approved metadata, ordered binary frames up to 64 KiB, cumulative byte acknowledgements with a 1 MiB sender window, a bounded 2 MiB receiver queue, and final SHA-256. A local Service Worker routes plaintext to a native browser download in secure contexts; it does not cache files or send bytes to a server. Unsupported browsers use a capped 128 MiB memory fallback. Interrupted P2P transfers require resending.

Send Later reserves nonce index zero for AES-GCM metadata and indexes one onward for file chunks. AAD binds version/share/index/count. The receiver validates authenticated metadata, ordering, chunk sizes, and completeness before closing the same streaming sink. Keys and download capabilities are carried in the sharing link fragment; API capabilities are sent in Authorization headers.
