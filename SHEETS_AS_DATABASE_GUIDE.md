# Google Sheets as Database — REMOVED

> **Status (2026-10-11): DEPRECATED AND REMOVED.** `USE_GOOGLE_SHEETS_AS_DB`
> no longer exists in this codebase. This guide is kept only for history.

## What changed

- **Postgres is the only primary database.** The dual-mode engine
  (`sheets_db_service.py`, `_is_sheets()` branches in every router) was
  deleted. The app refuses to start without `DATABASE_URL`.
- **Sheets remains available as an optional export/mirror only**, via
  `backend/scripts/sync_to_sheet.py` and `app/services/google_sheets_service.py`.
  Enable by setting `GOOGLE_SHEETS_CREDENTIALS_JSON` / `GOOGLE_SHEETS_SPREADSHEET_ID`.
- Attachments moved from base64-in-Sheets to S3-compatible object storage
  (Cloudflare R2 / AWS S3 / MinIO) with signed URLs.

## Why it was removed

- Sheets-as-DB had no transactions, FKs, or concurrency control; conflict-prone
  at scale and unfixable for relational integrity.
- Rate limits on the Sheets API caused random 429s under load.
- Row-level security was impossible; every worksheet was world-readable to the
  service account.

## Migration path (already applied in code)

1. Database schema now managed by Alembic (`alembic upgrade head`).
2. Data that lived in Sheets must be imported once into Postgres
   (see `backend/scripts/` for import helpers) — then point the app at Postgres.
3. See `PRODUCTION_SETUP.md` for the current deployment guide.
