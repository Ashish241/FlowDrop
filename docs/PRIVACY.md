# Privacy

FlowDrop requires no account. The LAN host stores session capability hashes, device display names, file metadata, temporary file chunks and completed payloads. Other participants see authorized device names; transfer listings and downloads are restricted to their own transfers. LAN files are retained for up to 24 hours or until cancellation/deletion; cleanup requires the host process to run.

HTTP LAN traffic is not encrypted. Use a trusted local network or configure trusted TLS. WebRTC uses encrypted DataChannels; STUN and TURN operators may observe network metadata. Signaling retains ephemeral room membership in process memory.

Send Later encrypts file chunks and filename/size metadata using browser Web Crypto AES-GCM. The server sees ciphertext sizes, chunk count, expiry and network metadata. Decryption keys stay in the browser and secret URL fragment. Anyone possessing the entire secret link can decrypt. Browser history, extensions, screenshots, clipboard synchronization or an infected device can disclose it.

Revocation prevents future authorized service downloads and requests object deletion. It does not erase already downloaded copies, backups, provider replicas, or storage media remnants. Deletion guarantees depend on the storage provider and operating system. Current cleanup monitoring and orphan reconciliation are incomplete.

Text history stays in page memory and can be cleared. Clipboard access is user initiated; no continuous clipboard monitoring is implemented. Camera access is requested only when the optical receiver is started, and tracks are stopped on Stop/reset/unmount. No analytics or tracking service is included.
