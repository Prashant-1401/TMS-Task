import re
"""Async SQLAlchemy engine — Postgres only, with proper pooling."""
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger("tms.database")

if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is not set. Postgres is the only supported primary database "
        "(Google Sheets is an optional export/mirror, never a DB)."
    )

_db_url = settings.database_url.strip()
# Accept both postgresql:// and postgres://; normalize to the asyncpg driver.
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)
if _db_url.startswith("postgresql://"):
    _db_url = _db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
# asyncpg doesn't understand libpq's sslmode param — translate it (e.g. Neon URLs
# ship with ?sslmode=require, which asyncpg rejects as an unknown DSN parameter).
_db_url = _db_url.replace("sslmode=", "ssl=")
# libpq-only params asyncpg doesn't support as DSN options — strip them
# (Neon appends ?channel_binding=require, which asyncpg rejects).
for _pq_param in ("channel_binding", "passfile", "hostaddr", "gssencmode"):
    _db_url = re.sub(rf"[?&]{_pq_param}=[^&]*", "", _db_url)
_db_url = _db_url.rstrip("?")

engine = create_async_engine(
    _db_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    pool_recycle=settings.db_pool_recycle,
    connect_args={"command_timeout": settings.db_command_timeout} if "+asyncpg" in _db_url else {},
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
