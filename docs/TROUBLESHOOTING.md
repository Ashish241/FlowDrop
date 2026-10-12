# Troubleshooting

| Symptom | Recovery |
|---|---|
| Another device cannot connect | Confirm the host is running, bind to the actual private adapter, use the displayed port, check firewall private-network permissions and Wi-Fi client isolation. |
| Pairing rejected | Renew the code from the host. Codes expire in ten minutes; pending requests also expire. Wait for explicit approval. |
| Transfer stops | Restore connectivity, reselect the original file on the sender, then resume/retry. Size and SHA-256 must match. |
| Host restarted | Client capabilities persist for their original lifetime. Host dashboard uses a fresh launcher capability. Original files may need reselection. |
| Unauthorized/expired session | Pair again or reopen the fresh host dashboard. Revoked capabilities cannot reconnect. |
| Hash mismatch | Cancel the failed transfer and create a new offer. Do not treat corrupted bytes as successful. |
| Port occupied | Choose `--port` explicitly, or `--port 0` for an available port. |
| Online service unavailable | Start/configure the independent signaling service and reverse proxy. Offline portable host contains no hosted infrastructure. |
| WebRTC cannot connect | Check exact allowed origin, WebSocket support, ICE service configuration, network/firewall and authenticated TURN availability. |
| Send Later unavailable | Run the optional development adapter or configure migrated PostgreSQL and private S3 with the cloud API. |
| Camera/clipboard unavailable | Use HTTPS or localhost where supported; otherwise use manual copying. Do not bypass browser security. |
| Chromium fails to spawn | Use the downloaded headless-shell browser, not the full `channel: chromium` executable in this environment. |
| Docker pipe unavailable | Start Docker Desktop and wait for its Linux engine. Container execution has not yet been verified here. |
