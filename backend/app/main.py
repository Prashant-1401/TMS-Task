"""TMS Backend — production-ready FastAPI app.

Postgres is the only primary database. Google Sheets remains an optional
export/mirror. All endpoints are JWT-authenticated.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import engine
from app.middleware.observability import (
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
    setup_logging,
)
from app.routers import (
    actions, audit, auth, departments, email_share, escalation, excel,
    machines, meetings, meetings_ai, plants, projects, reasons, roles,
    sessions, translate, users,
)

logger = logging.getLogger("tms.main")

# ── Fail fast on insecure configuration (weak/missing SECRET_KEY, no DB) ──
settings.validate_security()

setup_logging(settings.log_level)


def _sync_db_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url.replace("+asyncpg", "+psycopg2")


def _alembic_cfg():
    from alembic.config import Config as AlembicConfig
    root = os.path.join(os.path.dirname(__file__), "..")
    cfg = AlembicConfig(os.path.join(root, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(root, "migrations"))
    return cfg


async def _run_migrations() -> None:
    """Ensure schema exists at startup: try Alembic first; fall back to
    metadata.create_all + alembic stamp if the upgrade fails for any reason.
    An advisory lock serializes the two gunicorn workers."""
    import asyncio

    def _run() -> None:
        from sqlalchemy import create_engine
        from alembic import command as alembic_command
        from app.database import Base
        import app.models.models  # noqa: F401 — registers every table

        lock_eng = create_engine(_sync_db_url())
        try:
            lock = lock_eng.connect()
            lock.exec_driver_sql("SELECT pg_advisory_lock(918273645)")
            try:
                alembic_command.upgrade(_alembic_cfg(), "head")
                logger.info("startup: database schema is up to date (alembic head)")
            except Exception as e:
                logger.warning(f"startup: alembic upgrade failed ({e}); using create_all fallback")
                Base.metadata.create_all(lock_eng)
                try:
                    alembic_command.stamp(_alembic_cfg(), "head")
                except Exception as e2:
                    logger.warning(f"startup: alembic stamp skipped: {e2}")
                logger.info("startup: fallback schema creation completed")
            finally:
                lock.exec_driver_sql("SELECT pg_advisory_unlock(918273645)")
                lock.close()
        finally:
            lock_eng.dispose()

    try:
        await asyncio.to_thread(_run)
    except Exception as e:
        logger.error(f"startup: schema migration failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup: verifying database connectivity")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("database connection OK")
        await _run_migrations()
    except Exception as e:
        logger.error(f"database connectivity check failed: {e}")
        raise RuntimeError(
            "Cannot connect to Postgres. DATABASE_URL must point to a running "
            "Postgres instance — Google Sheets is no longer a primary database. "
            "Run Alembic migrations: alembic upgrade head"
        ) from e
    yield
    await engine.dispose()
    logger.info("shutdown: connection pool disposed")


# ── Optional Sentry (backend) — enabled only when SENTRY_DSN is set ──
if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            traces_sample_rate=0.1,
            integrations=[FastApiIntegration()],
        )
        logger.info("Sentry initialized")
    except ImportError:
        logger.warning("SENTRY_DSN set but sentry-sdk is not installed")


app = FastAPI(
    title="TMS Backend API",
    description="Task Management System — Backend API",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)

# ── CORS: explicit origins only ──
origins = settings.cors_origins
if not origins:
    if settings.is_production:
        raise RuntimeError("ALLOWED_ORIGINS must be set in production (comma-separated list).")
    origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning(f"IntegrityError on {request.url.path}: {exc.orig}")
    return JSONResponse(
        status_code=409,
        content={"detail": "Data conflict — a record with this value already exists. Please refresh and try again."},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"unhandled error on {request.url.path}: {type(exc).__name__}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/")
async def root():
    return {"message": "TMS Backend API is running", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
async def health():
    """Deep health check: verifies actual DB connectivity, reports components."""
    db_ok = False
    db_error = None
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_error = str(e)[:200]
    storage_ok = True
    storage_mode = "s3"
    try:
        from app.services.storage import get_storage, LocalStorage
        if isinstance(get_storage(), LocalStorage):
            storage_mode = "local-disk (configure S3_* for production)"
    except Exception as e:
        storage_ok = False
        storage_mode = f"error: {e}"

    healthy = db_ok and storage_ok
    return {
        "status": "ok" if healthy else "degraded",
        "database": {"ok": db_ok, "error": db_error},
        "storage": {"ok": storage_ok, "mode": storage_mode},
        "gemini_configured": bool(settings.gemini_api_key),
        "smtp_configured": bool(settings.smtp_user and settings.smtp_password),
        "sentry_enabled": bool(settings.sentry_dsn),
        "environment": settings.environment,
    }


@app.get("/api/ping")
async def ping():
    """Liveness probe (cheap, unauthenticated, no DB round-trip)."""
    return {"ok": True}


app.include_router(auth.router)
app.include_router(plants.router)
app.include_router(departments.router)
app.include_router(roles.router)
app.include_router(users.router)
app.include_router(machines.router)
app.include_router(reasons.router)
app.include_router(actions.router)
app.include_router(projects.router)
app.include_router(meetings.router)
app.include_router(escalation.router)
app.include_router(audit.router)
app.include_router(meetings_ai.router)
app.include_router(translate.router)
app.include_router(email_share.router)
app.include_router(sessions.router)
app.include_router(excel.actions_excel)
app.include_router(excel.users_excel)
app.include_router(excel.master_excel)
