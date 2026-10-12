# Development

Use Python 3.12+ and Node 22+. The actual Windows development checks used Python 3.14.6 and Node 24.18.0.

```powershell
python -m pip install -e ".[dev,cloud]"
cd apps/web
npm ci
npm run build
cd ../..
$env:FLOWDROP_DEV_CLOUD='1'
python -u -m scripts.dev_host
```

Open the printed host dashboard URL. The development host combines independent LAN, signaling, and optional local encrypted storage adapters on loopback. Production cloud storage uses PostgreSQL/S3; the local adapter is for development and tests. The portable offline launcher does not import cloud services.

Frontend development: `cd apps/web; npm run dev`. Vite alone has no backend proxy configured; use a production build served by the Python development host for integrated checks.

Backend checks: `python -m pytest -q`, `python -m ruff check services tests scripts apps/desktop`. Frontend: `npm test`, `npm run build`, `npx playwright install chromium`, `npx playwright test`.

Database migration: set DATABASE_URL for the intended database and run `python -m alembic upgrade head`. Do not run migrations against external databases without authorization and a backup/recovery plan. Development SQLite fixtures automatically create their own schema.

Generated storage, node dependencies, build folders, screenshots/test results, and executables are ignored by Git. Do not commit `.env` or session capabilities.
