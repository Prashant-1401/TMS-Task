# TMS — Production Setup Guide

Postgres-only primary DB, JWT-only auth, S3/R2 attachments.
See `CHANGELOG.md` for what changed and `RENDER_DEPLOY.md` for the Render walk-through.

## 1. Backend (Render)

Required environment variables:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string (Render Postgres or Neon). Sync URL is fine; the app converts to `postgresql+asyncpg://` automatically. |
| `SECRET_KEY` | `openssl rand -hex 32`. App refuses to boot if missing/weak/default. |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins, e.g. `https://tms.vercel.app`. Required in production. |
| `ENVIRONMENT` | `production` |

Optional but recommended:

| Variable | Notes |
|---|---|
| `S3_ENDPOINT_URL` | Cloudflare R2: `https://<account>.r2.cloudflarestorage.com`. Empty = AWS S3. |
| `S3_BUCKET_NAME` | Bucket for attachments. If unset, falls back to local disk (dev only). |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2/S3 credentials. |
| `SENTRY_DSN` | Backend error tracking. |
| `GOOGLE_SHEETS_CREDENTIALS_JSON` / `GOOGLE_SHEETS_SPREADSHEET_ID` | Optional export/mirror only — never a database. |
| `GEMINI_API_KEY`, `SMTP_*` | AI + email features. |

## 2. Migrations

The schema is managed by Alembic. `render.yaml` runs `alembic upgrade head` on
every deploy. For manual environments:

```bash
cd backend
alembic upgrade head          # apply all migrations
alembic revision --autogenerate -m "change"   # new migration
```

Never add DDL to the app lifespan — that was removed.

## 3. Frontend (Vercel)

| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | Backend URL, no trailing slash. |
| `VITE_SENTRY_DSN` | Optional frontend error tracking. |

There is **no API key** anymore. The frontend stores only the JWT from
`/api/auth/login` (localStorage) and sends `Authorization: Bearer <token>`.

## 4. Cloudflare R2 (or S3) for attachments

1. Create a bucket, e.g. `tms-attachments`.
2. Create an API token with Object Read & Write on that bucket.
3. Set `S3_ENDPOINT_URL`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`,
   `S3_SECRET_ACCESS_KEY` on Render.
4. Attachment uploads now go to the bucket; the DB stores metadata + URL only.
   Downloads use short-lived signed URLs. Max 25 MB per file; MIME types
   restricted to an allowlist (images, PDF, Office docs, zip).

## 5. Zero-downtime deploys

- gunicorn sends `SIGTERM` and drains for `--graceful-timeout 30` (see `render.yaml`).
- Health check `/api/health` verifies DB + storage; `/api/ping` is a cheap liveness probe.
- Migrations run before the new workers accept traffic.
