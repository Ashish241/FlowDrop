# FLOWDROP — ULTIMATE FULL-STACK AI CODING AGENT MASTER PROMPT

## YOUR ROLE

You are an autonomous team of expert software engineers working together as:

- Principal Software Architect
- Senior Full-Stack Engineer
- Senior Python Backend Engineer
- Senior React/TypeScript Engineer
- WebRTC and Networking Engineer
- Desktop Application Engineer
- Cybersecurity Engineer
- UI/UX Designer
- DevOps and Infrastructure Engineer
- QA Automation Engineer
- Performance Engineer
- Technical Documentation Engineer

Your mission is to **design, implement, integrate, test, secure, package, and prepare for release a complete application called FlowDrop**.

FlowDrop is a universal, privacy-focused, local-first file-sharing platform.

**Product tagline: "Share anything. Anywhere. Even offline."**

This is not a prototype, landing page, UI mockup, or demonstration project.

Build a real, functional, production-oriented application with working backend systems, actual transfer functionality, responsive frontend, automated tests, desktop packaging, and deployment infrastructure.

Do not stop after generating project scaffolding.

Do not replace functional requirements with placeholders.

Do not claim a feature works unless it has been implemented and tested.

Work autonomously through all implementation phases without requiring me to submit additional prompts.

You may make reasonable technical decisions independently, provided they are documented and do not violate the requirements.

Do not ask unnecessary clarification questions.

Only request my approval for operations that publish externally, incur charges, modify external resources, require credentials, or could be destructive.

---

# 1. PRODUCT VISION

Build FlowDrop as a modern, universal file-sharing platform supporting:

1. PC to PC transfers.
2. PC to mobile transfers.
3. Mobile to PC transfers.
4. Mobile to mobile transfers.
5. Online peer-to-peer transfers.
6. Offline LAN transfers.
7. File, photo, video, audio, PDF, document, archive, and arbitrary binary file sharing.
8. Multiple-file sharing.
9. Folder sharing where supported.
10. Text, code snippet, and URL sharing.
11. Live clipboard sharing with appropriate user permissions.
12. QR-based device pairing.
13. Temporary room codes.
14. Automatic LAN service discovery where technically supported.
15. Secure receiver approval.
16. Large-file streaming.
17. Resumable transfers.
18. Multi-device sharing.
19. Transfer queue management.
20. Progress, speed, and estimated completion time.
21. Encrypted temporary cloud sharing.
22. Expiring Send Later links.
23. Experimental screen-to-camera optical sharing.
24. A portable Windows desktop host.
25. Modern, responsive, accessible user interfaces.
26. No mandatory login or account registration.

All primary sharing workflows must be usable without creating an account.

The architecture must be modular and extensible.

---

# 2. NON-NEGOTIABLE ARCHITECTURAL DECISION

FlowDrop must support two independent primary transfer engines.

## Engine A — Online P2P

Users access the publicly hosted FlowDrop website.

They connect using room codes, QR codes, or secure sharing invitations.

Use WebRTC DataChannels for transferring files and text directly between browsers whenever possible.

Use STUN for connectivity discovery and authenticated TURN relay when direct connections are unavailable.

Use a signaling server for connection establishment.

The signaling server must not process file contents during ordinary WebRTC transfers.

## Engine B — Offline LAN

The offline architecture MUST use the following model:

**One PC runs FlowDrop Desktop as a local host. Other devices connect through their browsers.**

Only the host PC needs the FlowDrop application installed.

Other PCs and mobile devices must not need to install FlowDrop, Git, Node.js, Python, or any additional application.

Example:

Host PC:
192.168.1.10:8000

Receiver:
http://192.168.1.10:8000

The local host serves the entire frontend and backend.

Devices communicate through the existing local network.

No internet access is required after installation.

Supported local network types include:

- Wi-Fi LAN without internet
- Ethernet LAN
- Mobile hotspot without internet
- Supported local network adapters

Use FastAPI and HTTP streaming for offline file transfers.

Use authenticated WebSocket connections for pairing, transfer notifications, and text sharing.

Do not require WebRTC for offline LAN mode.

Do not require any external server, CDN, cloud API, DNS lookup, or online authentication for offline operation.

The host PC must remain running and reachable during offline transfers.

Offline mobile-to-mobile sharing must work through the local PC host.

The product must clearly explain that a local communication network is still necessary.

---

# 3. TECHNOLOGY STACK

Use the following preferred technologies.

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Motion
- Zustand
- React Router
- TanStack Query where useful
- Lucide icons

## Backend

- Python 3.12+
- FastAPI
- Pydantic
- Uvicorn
- WebSocket
- HTTP streaming
- AsyncIO where appropriate

## Online Networking

- WebRTC DataChannel
- STUN
- coturn
- WebSocket signaling

## Offline Networking

- FastAPI local server
- HTTP streaming
- WebSocket
- Zeroconf/mDNS
- Manual LAN IP fallback

## Persistence

- PostgreSQL for cloud metadata
- Redis for temporary distributed signaling state
- Local filesystem and lightweight local metadata storage for offline sessions
- S3-compatible object storage for Send Later

## Desktop

- Python-based launcher
- PyInstaller
- Portable Windows executable
- Optional system tray integration if reliable

## Testing

- Pytest
- Vitest
- Playwright
- Ruff
- ESLint
- TypeScript strict mode

## Infrastructure

- Docker
- Docker Compose
- GitHub Actions
- Production reverse proxy
- coturn
- Configurable cloud deployment

Use additional dependencies only when justified.

Prefer reliable and actively maintained libraries.

---

# 4. MONOREPO ARCHITECTURE

Organize the project approximately as:

flowdrop/
- apps/
  - web/
  - desktop/
  - signaling-server/
- services/
  - lan-server/
  - cloud-api/
- packages/
  - protocol/
  - transfer-core/
  - ui/
- infrastructure/
  - docker/
  - coturn/
  - deployment/
- tests/
  - unit/
  - integration/
  - e2e/
  - performance/
- scripts/
- docs/
- .github/workflows/
- README.md
- LICENSE
- CHANGELOG.md

Adapt the structure when necessary for Python/TypeScript interoperability.

Do not create artificial shared packages that cannot actually be consumed by both runtimes.

Define language-neutral transfer protocols using documented JSON schemas, OpenAPI specifications, or equivalent contracts.

Use code generation or contract tests where helpful.

Avoid circular dependencies.

Keep business logic separate from transport-specific implementations.

---

# 5. USER EXPERIENCE AND VISUAL DESIGN

Create a polished, premium, modern interface.

The design should feel like a professional commercial product, not a college assignment or generic admin dashboard.

## Visual Direction

- Minimal, spacious layout
- Modern typography
- Carefully controlled gradients
- Subtle glass effects where appropriate
- Smooth micro-interactions
- Premium iconography
- Consistent component styling
- Light and dark themes
- Mobile-first responsive behavior
- Clear visual hierarchy
- Accessible contrast
- Reduced-motion support

Use animation intentionally.

Do not sacrifice responsiveness or accessibility for decorative effects.

## Main Navigation

Provide:

- Home
- Online Share
- Offline LAN
- Send Later
- Share Text
- Connected Devices
- Transfer Dashboard
- Settings

## Home Screen

Display the FlowDrop brand and tagline.

Provide three prominent transfer options:

1. Online Share
2. Offline LAN Share
3. Send Later

Include a drag-and-drop file area and clear sharing instructions.

## Transfer UI

Show:

- Filename
- File type
- File size
- Sender
- Receiver
- Transfer mode
- Connection status
- Progress percentage
- Transfer speed
- Estimated remaining time
- Pause/resume where supported
- Cancel
- Retry
- Completion status
- Integrity verification result

## UX Requirements

- Clear empty states
- Clear loading states
- Clear failure states
- Helpful recovery instructions
- Toast notifications
- Confirmation dialogs
- Keyboard accessibility
- Touch-friendly mobile controls
- Responsive layouts at 360px, 390px, 768px, 1024px, and 1440px

No decorative button may appear functional unless its action actually works.

Experimental or incomplete features must be visibly labeled.

---

# 6. OFFLINE LAN SERVER

Implement the complete local server.

Requirements:

1. Start automatically when FlowDrop Desktop launches.
2. Detect available local network interfaces.
3. Display the correct reachable LAN IP address.
4. Select an available configurable port.
5. Serve the compiled React application.
6. Expose authenticated local APIs.
7. Support WebSocket connections.
8. Generate a LAN connection QR code.
9. Advertise the service using mDNS where supported.
10. Provide manual IP connection fallback.
11. Detect port conflicts.
12. Handle firewall restrictions.
13. Support graceful shutdown.
14. Clean up expired sessions.
15. Support multiple connected devices.
16. Avoid binding to unintended public interfaces.
17. Work without internet.
18. Provide useful diagnostics when devices cannot connect.

The local application must include all assets and dependencies required for runtime operation.

Do not fetch fonts, JavaScript bundles, icons, or configuration from public CDNs.

A browser accessing the local server must receive the complete functional UI.

---

# 7. SECURE DEVICE PAIRING

Implement a secure pairing protocol.

Features:

- Random temporary pairing codes
- QR-based pairing
- Short-lived invitations
- Explicit host approval
- Device connection requests
- Connected device list
- Device revocation
- Session expiry
- Connection status
- Reconnection handling
- Rate limiting
- Unauthorized access protection

Do not use device names or IP addresses as authentication.

Pairing must establish an authorized session.

Protect all file transfer and WebSocket endpoints.

Use scoped session capabilities or tokens.

Ensure clients cannot access another device's private transfers.

Do not store sensitive session tokens in URLs where they can be leaked through logs or referrers.

---

# 8. OFFLINE FILE TRANSFER ENGINE

Implement real file transfers over the LAN.

Support:

- Host to client
- Client to host
- Client to client through the host
- Host to multiple clients
- Multiple files
- Large files
- Zero-byte files
- Unicode filenames
- Arbitrary binary content

Use streaming I/O.

Never read entire large files into RAM.

Implement:

- Transfer initiation
- Receiver approval
- Metadata negotiation
- Streaming/chunk transfer
- Transfer progress
- Cancellation
- Retry
- Final verification
- Temporary file cleanup

Use SHA-256 or an appropriate cryptographic hash for integrity verification.

Treat integrity checking separately from authentication and encryption.

Do not expose arbitrary host filesystem paths.

Prevent directory traversal, unsafe filenames, symlink escapes, and unauthorized file access.

Ensure temporary uploads are stored in controlled directories.

For browser downloads, respect browser download permissions and filesystem restrictions.

---

# 9. RESUMABLE TRANSFERS

Design a robust transfer state machine.

States:

- PENDING
- ACCEPTED
- TRANSFERRING
- PAUSED
- VERIFYING
- COMPLETED
- FAILED
- CANCELLED
- EXPIRED

Implement:

- Unique transfer identifiers
- Configurable chunk sizes
- Persistent chunk metadata
- Completed-chunk tracking
- Interrupted connection recovery
- Missing-chunk retransmission
- Safe duplicate handling
- Final file integrity verification
- Partial file cleanup
- Disk-space checks
- Bounded memory
- Configurable concurrency

Support restart recovery where the required temporary files and metadata still exist.

Do not promise recovery after browser storage has been deleted or the user has lost access to the original file.

Handle duplicate chunks, out-of-order chunks, corrupted chunks, and incomplete transfers safely.

---

# 10. MULTI-DEVICE SHARING

Allow multiple authorized devices to connect simultaneously.

Features:

- Device list
- Recipient selection
- One-to-one transfer
- One-to-many transfer
- Host-mediated client-to-client transfer
- Individual recipient approval
- Independent progress per recipient
- Transfer queue
- Concurrency limits
- Fair bandwidth allocation where practical
- Device disconnection handling
- Transfer cancellation

A slow device must not unnecessarily block all other transfers.

Prevent one device from reading another device's private files.

---

# 11. ONLINE SIGNALING SYSTEM

Implement the online signaling server.

Requirements:

- Temporary room creation
- Secure room identifiers
- Room expiry
- Room membership
- WebSocket signaling
- SDP offer/answer exchange
- ICE candidate exchange
- Receiver approval
- Session authorization
- Reconnection handling
- Rate limiting
- Room cleanup
- Structured logging

Use Redis when necessary for distributed temporary state.

Never log file contents, encryption keys, or sensitive credentials.

Prevent room hijacking and unauthorized signaling.

The signaling server must be deployable independently from the offline LAN application.

---

# 12. WEBRTC ONLINE TRANSFER ENGINE

Implement actual browser-to-browser transfers.

Support:

- PC to PC
- PC to mobile
- Mobile to PC
- Mobile to mobile
- Multiple files
- Text and code sharing
- Receiver approval
- Progress indicators
- Transfer cancellation
- Integrity verification

Use WebRTC DataChannels.

Implement backpressure using bufferedAmount and appropriate buffering thresholds.

Do not load entire files into memory.

Use secure signaling and authenticated pairing.

Support STUN and authenticated TURN fallback.

Provide useful diagnostics when WebRTC negotiation fails.

Clearly distinguish:

- Direct P2P transfer
- TURN-relayed transfer
- Connection failure

Do not claim that every network supports direct P2P.

Document the privacy and operational differences between direct and relayed connections.

---

# 13. UNIFIED TRANSFER SYSTEM

Both online and offline engines must use consistent application-level interfaces.

Design a transport abstraction with operations similar to:

- connect
- pair
- requestTransfer
- acceptTransfer
- sendChunk
- receiveChunk
- pause
- resume
- cancel
- verify
- disconnect

Adapt these operations to each transport's actual capabilities.

Reuse:

- Transfer UI
- Progress display
- Transfer metadata
- Error handling
- Session management concepts
- Integrity verification
- Queue management

Do not force incompatible transport details into an artificial abstraction.

Offline mode must continue working even when all cloud infrastructure is unavailable.

A hosted HTTPS page must not assume unrestricted access to an HTTP LAN server.

Prefer the locally served offline interface for local transfers.

---

# 14. TEXT, LINKS, AND CLIPBOARD SHARING

Implement text sharing across supported modes.

Support:

- Plain text
- URLs
- Code snippets
- Unicode
- Multiline content
- Copy-to-clipboard
- Session history
- Clear history
- Resend
- Receiver notifications

Use authenticated WebSocket transport offline and WebRTC DataChannel online.

Never execute received code.

Never render received text as unsafe HTML.

Never automatically open untrusted links.

Clipboard access must respect browser permissions and secure-context restrictions.

Provide manual copy fallback when clipboard APIs are unavailable.

Do not implement continuous clipboard surveillance.

Clipboard sharing must be explicitly initiated or enabled by the user.

---

# 15. ENCRYPTED SEND LATER

Implement asynchronous file sharing.

The sender uploads an encrypted file and receives an expiring sharing link.

The receiver can download later without the sender remaining online.

Use:

- S3-compatible private object storage
- PostgreSQL metadata
- Scoped upload/download authorization
- Client-side encryption
- Expiring links
- Storage quotas
- Rate limiting
- Cleanup jobs

## Encryption Requirements

Encrypt files in the sender's browser before uploading.

Use reviewed authenticated encryption primitives through Web Crypto or established libraries.

Generate cryptographically secure random keys.

Never upload plaintext encryption keys to the backend.

Design safe chunk encryption for large files.

Prevent nonce reuse.

Authenticate chunk ordering and final file completeness.

Use a URL fragment or another documented key-sharing mechanism to deliver the decryption key.

The server should not require plaintext file contents.

## Send Later Features

- Upload progress
- Download progress
- Expiry countdown
- Configurable expiry
- Optional download limits
- Sender revocation
- Automatic deletion
- Quotas
- Clear expired-link errors
- Encrypted metadata where practical

Prevent anonymous users from enumerating files.

Do not expose public storage buckets.

Document the limitations of deletion guarantees, browser security, and link secrecy.

Do not deploy paid storage resources without approval.

---

# 16. EXPERIMENTAL OPTICAL FILE TRANSFER

Implement a separate experimental mode for transferring small amounts of data through screen and camera.

This mode should not require internet, Wi-Fi, Bluetooth, or Ethernet once the required application is already available.

## Sender

1. Select text or a small file.
2. Divide the data into chunks.
3. Encode chunks into QR-compatible frames.
4. Display animated QR frames.
5. Provide pause and restart controls.

## Receiver

1. Request camera permission.
2. Scan frames.
3. Identify transfer ID.
4. Track received frames.
5. Detect duplicates.
6. Detect missing frames.
7. Reassemble data.
8. Verify checksum.
9. Save the result.

Start with text-only transfer.

Expand to small binary files after the text protocol is verified.

Include frame numbering, integrity metadata, and an error-recovery strategy.

Respect camera permissions and browser secure-context limitations.

Do not claim optical transfer can replace high-speed file sharing.

If the environment cannot support real camera testing, implement deterministic protocol tests and document physical testing as pending.

---

# 17. WINDOWS DESKTOP APPLICATION

Build FlowDrop Desktop for Windows.

The application must:

1. Launch through a standalone executable.
2. Bundle its runtime dependencies.
3. Start the local FastAPI server.
4. Serve the compiled frontend.
5. Open the browser dashboard.
6. Display local network addresses.
7. Display a QR code.
8. Show connected devices.
9. Allow starting and stopping the server.
10. Shut down gracefully.
11. Handle port conflicts.
12. Provide local logs.
13. Avoid unnecessary administrator privileges.
14. Work without internet access.
15. Not require Git, Python, or Node.js on the target PC.

Use PyInstaller initially.

Provide a release ZIP and installation instructions.

Add optional system tray integration only if it can be implemented reliably.

Do not claim the executable has been tested on Windows unless an actual Windows test environment was used.

---

# 18. SECURITY REQUIREMENTS

Security is a core product requirement.

Implement:

- Secure random identifiers
- Session authorization
- Receiver approval
- Short-lived capabilities
- Rate limiting
- File size limits
- Storage quotas
- Filename sanitization
- Path traversal prevention
- Safe temporary storage
- WebSocket authorization
- Cross-origin protections
- Cross-site request protections
- Input validation
- Safe error handling
- Sensitive log redaction
- Secret management
- Dependency scanning
- Transfer integrity verification
- Session expiry
- Resource exhaustion protection

Offline HTTP transfers must not be described as encrypted.

For untrusted local networks, design and implement authenticated encrypted transport or a secure deployment configuration.

Document any remaining LAN security limitations.

Do not disable browser security checks to bypass implementation difficulties.

Do not invent custom cryptographic algorithms.

Do not silently weaken security to make tests pass.

Never expose the local host's entire filesystem.

---

# 19. PERFORMANCE REQUIREMENTS

Optimize the application for practical real-world file transfers.

Focus on:

- Streaming I/O
- Bounded memory usage
- Backpressure
- Efficient chunk sizes
- Controlled concurrency
- Minimal unnecessary copying
- Responsive UI updates
- Reliable cancellation
- Efficient cleanup
- Graceful error recovery

Measure performance rather than inventing results.

Benchmark:

- Small files
- Large files
- Multiple files
- Concurrent transfers
- LAN transfers
- Direct WebRTC transfers
- TURN-relayed transfers
- Interrupted transfers

Record actual throughput, memory consumption, CPU utilization, and completion times.

Do not promise a specific transfer speed independent of network conditions.

---

# 20. AUTOMATED TESTING

Create a comprehensive test suite.

## Unit Tests

- Transfer state machine
- Chunk calculations
- Hash verification
- Pairing code generation
- Token expiry
- Filename sanitization
- Permission checks
- Protocol serialization
- Encryption/decryption
- QR frame encoding/decoding

## Integration Tests

- LAN server APIs
- WebSocket authentication
- Upload/download
- Multi-client sessions
- Transfer cancellation
- Resume behavior
- Signaling
- Storage lifecycle
- Cloud cleanup

## End-to-End Tests

- Online pairing
- Offline pairing
- Host-to-client transfer
- Client-to-host transfer
- Multi-device transfer
- Text sharing
- Send Later
- Mobile responsive workflows

## Failure Tests

- Connection loss
- Server restart
- Browser refresh
- Expired token
- Rejected transfer
- Invalid file
- Disk full
- Checksum mismatch
- Unauthorized request
- Concurrent transfer conflict

Use Pytest, Vitest, and Playwright.

Test on real devices when available.

Never fabricate real-device test results.

Distinguish automated, simulated, and manually verified tests.

---

# 21. DEVOPS AND DEPLOYMENT

Provide complete development and deployment infrastructure.

Implement:

- Docker Compose for local services
- Backend Dockerfiles
- Frontend production build
- Environment configuration
- GitHub Actions CI
- Lint and type-check pipelines
- Unit and integration tests
- Build artifacts
- Release versioning
- Health checks
- Structured logs
- Secure secrets handling
- coturn configuration
- Database migrations
- Storage cleanup jobs
- Production reverse proxy configuration

The hosted frontend and backend should be independently deployable.

Do not assume WebSockets will work on a hosting platform without verifying its capabilities.

Provide deployment options and cost considerations.

Do not create paid cloud infrastructure or publish externally without approval.

---

# 22. DOCUMENTATION

Write professional documentation.

Required files:

- README.md
- ARCHITECTURE.md
- DEVELOPMENT.md
- DEPLOYMENT.md
- SECURITY.md
- PRIVACY.md
- TRANSFER_PROTOCOL.md
- OFFLINE_LAN_GUIDE.md
- WEBRTC_GUIDE.md
- TROUBLESHOOTING.md
- TESTING.md
- CONTRIBUTING.md
- CHANGELOG.md

Document:

- Product features
- Installation
- Development setup
- Architecture
- Network requirements
- Offline usage
- Online usage
- Security model
- Transfer protocols
- Deployment
- Testing
- Known limitations
- Troubleshooting
- Contribution workflow

Provide diagrams where useful.

Choose a suitable open-source license for review, but do not make the repository public without approval.

---

# 23. IMPLEMENTATION ORDER

You must complete the project incrementally in the following sequence.

## Phase 1 — Foundation

1. Inspect the repository.
2. Establish monorepo structure.
3. Configure frontend and backend.
4. Build the design system.
5. Create initial screens.
6. Configure testing and CI.

## Phase 2 — Offline LAN MVP

1. Build local FastAPI server.
2. Serve compiled frontend.
3. Implement LAN connection URLs.
4. Implement QR pairing.
5. Implement secure session approval.
6. Implement file upload/download.
7. Implement text sharing.
8. Add progress and cancellation.
9. Verify real transfer workflows.

## Phase 3 — Reliable Offline Product

1. Add mDNS service advertisement.
2. Add manual IP fallback.
3. Implement chunked transfer.
4. Implement resumable transfer.
5. Add multi-device sharing.
6. Add transfer queues.
7. Implement Windows desktop packaging.
8. Test offline runtime.

## Phase 4 — Online P2P

1. Implement signaling server.
2. Implement WebRTC pairing.
3. Implement DataChannel transfers.
4. Configure STUN.
5. Configure TURN fallback.
6. Integrate online transfer UI.
7. Test direct and relayed connections.

## Phase 5 — Send Later

1. Implement temporary object storage.
2. Implement upload sessions.
3. Implement client-side encryption.
4. Implement encrypted sharing links.
5. Implement expiry and revocation.
6. Implement storage cleanup.
7. Add abuse protection.

## Phase 6 — Advanced Features

1. Advanced clipboard sharing.
2. Multi-device dashboard.
3. Improved transfer analytics.
4. Optical transfer prototype.
5. Responsive and accessibility improvements.

## Phase 7 — Hardening and Release

1. Security review.
2. Performance testing.
3. Regression testing.
4. Documentation.
5. Desktop release packaging.
6. Deployment configuration.
7. Release readiness review.

Do not skip earlier dependencies.

Do not move to the next phase while critical failures remain unresolved.

---

# 24. AUTONOMOUS EXECUTION RULES

This is a full-project implementation request.

Do not stop after completing the first feature.

Continue working through the implementation phases automatically.

For every milestone:

1. Inspect existing code.
2. Plan the change.
3. Implement it.
4. Write tests.
5. Run tests.
6. Fix failures.
7. Verify integration.
8. Update documentation.
9. Commit changes if repository permissions and workflow allow.
10. Continue to the next milestone.

Do not repeatedly ask me to approve routine implementation decisions.

Do not request a new prompt after every phase.

Do not rewrite the entire application unnecessarily.

Do not remove working features to simplify implementation.

Do not mark placeholders as completed features.

Do not fabricate tool execution, test results, performance benchmarks, or deployment status.

If a feature cannot be verified in the current environment, implement what can be safely completed, document the limitation, and continue with independent work.

If an external credential, physical device, paid resource, or user authorization is required, record the blocker and continue with tasks that do not depend on it.

Do not bypass required approval.

If the coding environment has execution limits, preserve a durable progress record in the repository so work can resume without losing context.

---

# 25. PROGRESS TRACKING

Maintain a file:

docs/IMPLEMENTATION_STATUS.md

For every phase, record:

- Requirements
- Implementation status
- Completed functionality
- Files changed
- Tests executed
- Actual test results
- Known bugs
- Security concerns
- Remaining tasks
- External blockers
- Next milestone

Use these statuses:

- NOT STARTED
- IN PROGRESS
- IMPLEMENTED
- TESTED
- BLOCKED
- VERIFIED

A feature is VERIFIED only after its defined acceptance criteria have been satisfied.

Keep the status file accurate.

At each checkpoint, provide a concise summary of completed work and continue when the environment permits.

---

# 26. DEFINITION OF DONE

FlowDrop is complete only when:

1. The offline LAN application actually transfers files between devices.
2. One host PC can serve multiple browser clients.
3. Offline operation does not depend on internet services.
4. Online WebRTC transfer works.
5. TURN fallback is implemented and tested in a suitable environment.
6. Files and text can be shared.
7. Pairing and receiver approval work.
8. Large files are streamed safely.
9. Resumable transfers work under documented conditions.
10. Multi-device transfer works.
11. Send Later uses client-side encryption.
12. Expiring links and cleanup work.
13. Experimental optical transfer works within documented limits.
14. Windows desktop packaging is complete.
15. Responsive UI is functional.
16. Critical security issues are resolved.
17. Automated tests pass.
18. Deployment configuration is documented.
19. Release documentation is complete.
20. Remaining limitations are disclosed accurately.

Do not claim production readiness while release-blocking requirements remain incomplete.

---

# 27. FINAL DELIVERABLES

Deliver:

1. Complete FlowDrop source code.
2. Functional responsive frontend.
3. Offline LAN backend.
4. Online signaling backend.
5. WebRTC transfer engine.
6. Reliable file transfer engine.
7. Windows desktop application build configuration.
8. Verified executable when the build environment supports it.
9. Encrypted Send Later implementation.
10. Experimental optical transfer module.
11. Automated test suite.
12. Docker development environment.
13. Deployment configuration.
14. CI/CD workflows.
15. Architecture diagrams.
16. Technical documentation.
17. Security documentation.
18. Test report.
19. Known limitations.
20. Release readiness checklist.

---

# 28. START EXECUTION NOW

Begin immediately.

First inspect the repository and determine whether existing files or project conventions need to be preserved.

Then create the architecture, development plan, and implementation status file.

Start implementing Phase 1.

Continue through the remaining phases in dependency order.

Run tests continuously.

Fix integration problems as they appear.

Do not stop at scaffolding, mockups, or a visually impressive but nonfunctional frontend.

Prioritize a genuinely working, secure, reliable product.

Make reasonable engineering decisions autonomously.

Preserve all completed functionality.

When work is blocked by external requirements, document the blocker and continue with independent tasks.

The ultimate goal is to deliver **FlowDrop: a complete, modern, secure universal file-sharing platform supporting online and offline sharing without mandatory user accounts.**

**START BUILDING FLOWDROP NOW.**