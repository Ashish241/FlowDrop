# 0.3.2 online checkpoint rollback

Previous working source: `febcc95` (0.3.1 / LAN-20261015.2). Preserved working ZIP: `dist/checkpoints/FlowDrop-0.3.1-LAN-working.zip`, SHA-256 `46AFB58F60D56ADC9BAE58DD7B77757D5290483A7A59F53CC499B1E5EC5BA4D5`. The existing `dist/FlowDrop-windows` extraction is retained; the new 0.3.2 extraction is `dist/FlowDrop-online-0.3.2`.

Stop the active application, back up user data and extract the chosen ZIP into a fresh folder before deliberately updating shortcuts. No schema change was introduced. `%LOCALAPPDATA%/FlowDrop/online.json` stores optional public endpoint settings only; remove it to reset Online Sharing, without changing LAN data/network preferences. Environment variables override saved settings. No older data, checkpoint or installed service was deleted.

---

# 0.3.1 LAN checkpoint rollback

Previous source checkpoint: `7c1c487`. Previous working ZIP preserved at `dist/checkpoints/FlowDrop-0.3.0-lan-fix1.zip`, SHA-256 `9912DD2F4A53D0306166FB67CF5506B0F6EE0254A549E99B3C2E18F7E99138ED`. The confirmed older extraction that lacks `--lan` is preserved under `dist/checkpoints/stale-extracted-0.3.0-no-lan`; it is **not** the corrected application.

Stop FlowDrop before switching folders. Extract the chosen backup into a separate fresh folder and update shortcuts deliberately. Preserve `%LOCALAPPDATA%/FlowDrop/data` before rollback; no schema migration was introduced by 0.3.1. The new `%LOCALAPPDATA%/FlowDrop/network.json` stores only adapter identity and may be removed to reset preference; LAN opt-in is never restored automatically. Older builds have no native dual-listener/readiness diagnostics and may require explicit `--bind`.

---

# Development rollback

v0.3.0 predecessor: `721668cabd0c47a93ecd1a80e240d8f526e45211`. The previous archive is `dist/FlowDrop-windows-v0.2.0.zip`, SHA-256 `E1CD5C70A698066BC0285BD7A3A3EFDDE34137159C4EA683BA9F1B566DBF77F6`. Stop hosts/services and preserve needed links and data before changing source revisions. Use a separate detached worktree for inspection. The schema remains migration 0002, so no database downgrade is required to return to v0.2.0. The old frontend does not manage the v0.3.0 IndexedDB queue; clear browser site data manually if you want to erase it. Instructions below retain the older v0.1.0 rollback history.

The prior source checkpoint is `780ed3f57a0f80558b038626904122e83c49070c`. Preserve current work before changing revisions. For safe inspection without modifying this checkout, create a separate directory with `git worktree add --detach <new-directory> 780ed3f`.

The previous ZIP is preserved as `dist/FlowDrop-windows-v0.1.0.zip`. Stop the active host before running an older executable. Back up `%LOCALAPPDATA%/FlowDrop/data` separately; source control does not contain live transfer data.

Cloud migration 0002 adds session-limit fields/table. Existing unlimited shares retain defaults. Back up the database before upgrade/downgrade. Use `python -m alembic downgrade 0001` only after stopping cloud workers and accepting loss of download-session limits/leases. Never run two versions against the same transfer directory/database simultaneously. Existing SQLite development databases also need `DATABASE_URL` set and `python -m alembic upgrade head` before restart.
