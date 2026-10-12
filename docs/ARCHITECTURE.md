# Architecture

The local React application is served by FastAPI. Browser clients authenticate with short-lived bearer capabilities. Host approval and recipient acceptance are separate decisions. The server stores chunks under random transfer identifiers, verifies the final SHA-256, and only permits the recipient to download. File names never determine storage paths.

```mermaid
flowchart LR
  Host[Host browser] --> LAN[Local FastAPI host]
  Phone[Mobile browser] --> LAN
  PC[Other PC browser] --> LAN
  LAN --> Disk[Controlled transfer storage]
```

Online signaling and cloud storage are independent services and are not imported by the portable LAN runtime. WebRTC carries ordinary online file bytes directly; signaling only exchanges room/SDP/ICE messages. Send Later encrypts browser-side before storage. A shared streaming sink handles WebRTC reception and decrypted cloud chunks without routing P2P contents through the server.

```mermaid
flowchart LR
  A[Sender browser] <-->|SDP and ICE| SIG[Signaling]
  B[Receiver browser] <-->|SDP and ICE| SIG
  A <-->|Encrypted WebRTC DataChannel| B
  A -->|AES-GCM ciphertext| API[Cloud API]
  API --> DB[PostgreSQL metadata]
  API --> S3[Private S3 objects]
  S3 --> API
  API -->|Ciphertext| B
  B -->|Local stream| SAVE[Browser downloads]
```

Current API schemas are discoverable at `/openapi.json`. Authentication capabilities are never placed in API query strings. The host launcher provides its initial capability in a URL fragment, which the UI removes and stores in tab session storage.
