# Development rollback

v0.3.0 predecessor: `721668cabd0c47a93ecd1a80e240d8f526e45211`. The previous archive is `dist/FlowDrop-windows-v0.2.0.zip`, SHA-256 `E1CD5C70A698066BC0285BD7A3A3EFDDE34137159C4EA683BA9F1B566DBF77F6`. Stop hosts/services and preserve needed links and data before changing source revisions. Use a separate detached worktree for inspection. The schema remains migration 0002, so no database downgrade is required to return to v0.2.0. The old frontend does not manage the v0.3.0 IndexedDB queue; clear browser site data manually if you want to erase it. Instructions below retain the older v0.1.0 rollback history.

The prior source checkpoint is `780ed3f57a0f80558b038626904122e83c49070c`. Preserve current work before changing revisions. For safe inspection without modifying this checkout, create a separate directory with `git worktree add --detach <new-directory> 780ed3f`.

The previous ZIP is preserved as `dist/FlowDrop-windows-v0.1.0.zip`. Stop the active host before running an older executable. Back up `%LOCALAPPDATA%/FlowDrop/data` separately; source control does not contain live transfer data.

Cloud migration 0002 adds session-limit fields/table. Existing unlimited shares retain defaults. Back up the database before upgrade/downgrade. Use `python -m alembic downgrade 0001` only after stopping cloud workers and accepting loss of download-session limits/leases. Never run two versions against the same transfer directory/database simultaneously. Existing SQLite development databases also need `DATABASE_URL` set and `python -m alembic upgrade head` before restart.
