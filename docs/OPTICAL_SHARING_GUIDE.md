# Optical Sharing — integrated 0.4.0

Optical Share is available in both offline Desktop and the standalone Online website. It uses locally loaded QR generation/decoding and hashing; after both pages/assets load, optical payloads require no network. It does not require a room or signaling service. Checksums detect corruption but do not authenticate the person displaying a QR.

## Send

Open Optical Share, choose Share Text (up to 16 KiB UTF-8) or Share Small File (up to 64 KiB), then Create frames. Keep the animated sequence visible. Pause/Resume frames, Restart frames and Frame speed (200–2000 ms) control repetition. Start slower, align both screens and reduce glare. Frame number and total are shown. Small payloads are much more practical than the maximum; a 64 KiB file uses 328 frames and may take minutes. This is not a large-file transfer channel.

## Receive

On a supported HTTPS or localhost page, Start camera and grant permission. Point the camera at the sender's QR. The receiver tracks received, missing and duplicate frames, accepts out-of-order frames, and completes only after every frame and the SHA-256 checksum agree. Repeated loops recover missed frames. Reset receiver before accepting a different transfer. Stop camera or leave Optical Share to release the camera.

On insecure LAN HTTP, browser camera access may be unavailable. Use the explicit Import QR frame image fallback with saved screenshots/photos, the host PC's localhost dashboard, or a properly trusted HTTPS deployment. Do not disable browser security. Images are limited to 5 MiB and a bounded decoding canvas. Imported QR frames use the same decoder/protocol as camera frames. These fallbacks still require a way to obtain the images; they are not a claim of live camera access over HTTP.

Completed text is displayed safely for selection/copy. Completed files are reconstructed as binary Blobs and can be downloaded with a sanitized filename and generic binary content type. A browser download handoff is not proof that the user saved the file to disk. Clear/reset received content when finished; data is not uploaded or executed.

## Protocol and safety

Existing version-1 text frames remain supported. Version-2 file frames add bounded filename, binary MIME and exact byte-size metadata. Both use a random transfer ID, index/count, 200-byte chunks, base64url encoding and whole-payload SHA-256. Metadata must match across frames; malformed/oversized frames, conflicting duplicates, unsafe names, excess frame counts and hash/size mismatch are rejected. QR level-M error correction plus cyclic repetition improves scanning resilience; missing frames must be rescanned, not invented. There is no cross-frame parity recovery or sender authentication.

Automated evidence includes real QR raster decoding, 64 KiB binary loss/reorder/duplicate recovery, malformed metadata and corruption rejection, real PNG frame imports with browser networking disabled, sender controls and simulated camera-denial UI in both products. No physical screen-to-camera, phone permission prompt, camera focus/glare or mobile save test was performed. Those remain acceptance gates.
