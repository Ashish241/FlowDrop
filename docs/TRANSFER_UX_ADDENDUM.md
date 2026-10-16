# Transfer UX and recipient lifecycle addendum — 2026-10-17

This continues the deployed full-page workspace. Offline LAN and Optical Share retain their existing entry points and protocols. The previous working source is `770c351590c0f76cd43f5c1450bca2726004e5ed`; previous public Pages deployment is `173ba695-b61b-4ba8-a840-26879a26ea56` (source `236535d`). They remain rollback references.

## Changes and causes

The composer previously had no per-file/per-recipient delivery ledger: selections stayed indefinitely, and its generic per-device Retry could resend files already verified by that device. Recipient selections started empty and were only filtered on membership updates. These are addressed in the existing room controller and transport adapter.

`room-delivery.ts` defines attachment, recipient, attempt and terminal verification state. The controller snapshots recipients at explicit Send, preserves the original File objects, and tracks each intended recipient independently. Repeated Send does not duplicate an in-flight attempt or add late members to that attachment. A new attachment uses the current selection. Existing attachment recipient snapshots remain fixed; select a file again after manually removing it to start a new delivery set.

Verified is terminal. Stale callbacks from old attempts cannot overwrite a retry or downgrade success. Retry creates a fresh attempt for one failed/declined/cancelled recipient, retaining verified peers. An unavailable recipient cannot be retried until reconnected. Actual membership departure fails unfinished delivery and excludes the device from new snapshots. Explicitly removed attachments are not recreated by progress callbacks. All intended recipients must verify before automatic removal; each file in a batch clears separately. A compact expandable record remains, with the last ten fully verified records retained. Dismiss hides a completed recipient row without discarding its verification or resending it.

New eligible online member IDs are selected once per sender. A local seen-ID set preserves Clear Selection, manual deselection and Select All through unrelated roster, rename, invitation and reconnect events. Self is excluded. New identities are new devices; no preferences are sent to the server or other participants. Auto-selection never calls Send. A full page reload still requires file reselection and starts fresh local selection preferences.

The transport reports Preparing, Request sent, Waiting for approval, Accepted, Sending, Paused, Verifying, Verified, Declined, Failed and Cancelled. Progress follows receiver acknowledgements. Success is reported only through the existing complete-byte, pending-verification guard after receiver SHA-256 verification. New room control messages include the wire transfer ID and mismatched IDs are ignored; legacy ID-less messages remain compatible with the existing verification guards. Verified receipt does not claim the browser saved bytes to disk.

The room backend is unchanged: stable internal ID, atomic collision-protected ten-minute invitation rotation, invalidated old codes, automatic code/link/QR refresh and authenticated heartbeat renewal. Invitation expiration does not terminate connected members or transfers. Idle expiry is one hour, with a 24-hour absolute room bound. Existing free single-instance memory still loses rooms on provider restart; no new shared service was provisioned.

## Files

- `apps/web/src/room-delivery.ts` and tests: recipient selection and guarded delivery state.
- `apps/web/src/room-dashboard.tsx`: retained attachment ledger, snapshot/retry rules, auto-selection and compact recipient records.
- `apps/web/src/online.tsx`: actual transport callbacks and correlated room control frames.
- `apps/web/src/online-style.css`: compact recipient status/progress styling.
- `apps/web/e2e/delivery.spec.ts`, room/workspace regressions and Playwright configs: real byte tests and revised auto-selection/auto-removal expectations.
- `apps/web/vite.config.ts`, `scripts/verify_rooms_deployment.py`: explicit deployed feature metadata and public checks.

## Verification

Backend: 84 passed, 7 unconfigured provider skips. Frontend units: 19 passed. Desktop: 8 passed. Preserved combined regression: 20 passed, 1 unconfigured positive TURN relay skip. Lint, strict TypeScript, production builds and Ruff passed. Production Online: 13 passed, including the two new delivery scenarios and existing code-rotation checks. Vite room tests: 3 passed. Public results are recorded in `DELIVERY_VERIFICATION.json` after deployment.

The new four-context browser case verifies original attachments during partial success, a real recipient decline, a failed retry through actual channel closure, reconnect/retry, saved-byte equality, no duplicate offer/download for the already verified device, late-member exclusion, automatic selection, manual deselection through reconnect/rename and separate sender preferences. A two-file test accepts each offer separately and verifies individual attachment removal only after actual received bytes. Existing tests cover code/QR rotation, active paused-transfer continuity, self-exclusion, security, text, Optical Share and responsive widths.

Initial existing-test assertions assumed empty selection and manual file clearing; they were updated to choose their intended recipients and assert automatic clearing. One obsolete run was interrupted after these expectation failures. Final passing runs are recorded separately. Same-PC public Chromium tests and synthetic camera fixtures do not prove physical phone or different-network connectivity.

## Deployment and limits

Only the existing authorized Cloudflare Pages Free frontend needs deployment; the Render Free backend is unchanged and will be verified for compatibility. Automatic deployments remain paused. No new accounts, projects, billing, dependencies or secrets are introduced. Exact deployment identity, source commit and public results will be recorded after deployment.

Windows executable and ZIP are preserved. ZIP SHA-256: `CF8E76E3D14FA88FA3D77F2629BBFCE155E58A1C38F7BA05B7DBB1EBF5590E18`.

External acceptance still required: physical PC↔phone across Wi-Fi/cellular networks, real QR cameras, mobile background/suspension behavior and TURN relay. TURN is unconfigured. Full reload requires file reselection; provider restart requires a fresh room. The physical checklist in `WORKSPACE_REDESIGN.md` still applies.
