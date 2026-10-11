# CHANGELOG — TMS Production Hardening

## 2026-10-11 — Production refactor

### 1. Database (Critical)
- **Postgres is the only primary database.** Removed `USE_GOOGLE_SHEETS_AS_DB`
  and the entire Sheets-as-DB branch (`sheets_db_service.py` and all dual-mode
  `if _is_sheets()` paths deleted from routers/models).
- Google Sheets is kept **only as an optional export/mirror** via
  `sync_to_sheet.py` + `google_sheets_service.py` (opt-in via
  `GOOGLE_SHEETS_SPREADSHEET_ID`).
- **Alembic replaces lifespan `ALTER TABLE` hacks.** Initial migration
  `migrations/versions/0001_initial_schema.py` creates the full schema with
  proper **foreign keys**, indexes, and `is_deleted` **soft-delete** columns.
  No DDL at runtime.
- Async engine runs with pooling (`pool_size`, `max_overflow`, `pool_pre_ping`,
  `pool_recycle`).

### 2. Security (Critical)
- **`VITE_API_KEY` removed entirely** (frontend + backend + docs). All requests
  authenticate with JWT Bearer tokens only; `/api/auth/*` and health probes
  stay public.
- **Attachment endpoints now require auth** (`get_current_user` on upload /
  download / delete) — previously zero auth.
- **`SECRET_KEY` fail-fast validation**: the app refuses to boot with a missing,
  default, or short (<32 chars) secret. `openssl rand -hex 32` suggested.
- **Rate limiting**: login (per IP + username) and AI/Gemini endpoints
  (`slowapi`).
- **HTTPS + secure headers**: HSTS, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, CSP on API responses.
- `.env.example` files contain no real secrets; legacy secrets removed from
  docs.

### 3. File Storage
- Attachments no longer stored as base64 in the DB.
- **S3-compatible object storage** (`app/services/storage.py`): Cloudflare R2,
  AWS S3, MinIO, or local disk for dev. DB keeps metadata + storage URL only.
- **Signed download URLs** with expiry.
- Enforced **file size limit** (25 MB default) and **MIME-type allowlist**.
- Graceful backfill path: legacy base64 rows are downloaded and streamed to
  storage on first access.

### 4. Frontend Architecture
- **7,526-line `src/App.jsx` split** into:
  - `src/api/` — `client.js` (fetch wrapper, token handling),
    `autosave.js` (optimistic save queue)
  - `src/components/` — Shell, LoginPage, ErrorBoundary, Modals, panels
  - `src/pages/` — Home, Dashboard, Work, Actions, Escalations, Master
  - `src/hooks/` — usePostgresDB, useNotifications, useRealtimeSync, etc.
  - `src/store/AppContext.jsx` — global state context
  - `src/utils/` — data, permissions, theme, helpers, constants
- **React Router** with real routes; `useNavigate` replaces manual tab state.
- **Error boundaries** and loading states wired at app level.
- ESLint clean (0 errors); production build passes.

### 5. Production Infrastructure
- **Structured JSON logging** with request-ID middleware
  (`app/middleware/observability.py`).
- **Sentry** hooks (backend FastAPI integration + frontend VITE_SENTRY_DSN).
- **`/api/health`** now checks DB connectivity + storage; `/api/ping` for
  cheap liveness.
- `render.yaml` blueprint: gunicorn + uvicorn workers (2), health check,
  graceful timeouts for zero-downtime deploys.
- Removed obsolete `strip_sheets_branches.py` migration helper.

## Manual configuration required (see PRODUCTION_SETUP.md)
- Set `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS` on Render.
- Create S3/R2 bucket + credentials (`S3_*` env vars).
- Set Sentry DSNs for backend + frontend.
- Run `alembic upgrade head` on deploy (render.yaml does this automatically).
- Rotate/remove any previously-exposed secrets (old API key, spreadsheet URL
  in old docs).
