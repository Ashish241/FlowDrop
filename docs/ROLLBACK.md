# Development rollback

The prior source checkpoint is `780ed3f57a0f80558b038626904122e83c49070c`. Preserve current work before changing revisions. For safe inspection without modifying this checkout, create a separate directory with `git worktree add --detach <new-directory> 780ed3f`.

The previous ZIP is preserved as `dist/FlowDrop-windows-v0.1.0.zip`. Stop the active host before running an older executable. Back up `%LOCALAPPDATA%/FlowDrop/data` separately; source control does not contain live transfer data.

Cloud migration 0002 adds session-limit fields/table. Existing unlimited shares retain defaults. Back up the database before upgrade/downgrade. Use `python -m alembic downgrade 0001` only after stopping cloud workers and accepting loss of download-session limits/leases. Never run two versions against the same transfer directory/database simultaneously. Existing SQLite development databases also need `DATABASE_URL` set and `python -m alembic upgrade head` before restart.
