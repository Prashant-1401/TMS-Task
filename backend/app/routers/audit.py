from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models.models import Audit
from app.schemas.schemas import AuditCreate
from app.middleware.auth import require_auth

router = APIRouter(prefix="/api/audit", tags=["Audit"], dependencies=[Depends(require_auth)])


@router.get("/")
async def list_audit(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    skip = max(0, skip)
    limit = max(1, min(limit, 500))
    result = await db.execute(select(Audit).order_by(Audit.ts.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/")
async def create_audit_entry(data: AuditCreate, db: AsyncSession = Depends(get_db)):
    entry = Audit(**data.model_dump())
    db.add(entry)
    try:
        await db.commit()
        await db.refresh(entry)
    except IntegrityError:
        await db.rollback()
        return {"ok": True, "skipped": True}
    return entry


@router.post("/batch")
async def batch_audit(entries: list[AuditCreate], db: AsyncSession = Depends(get_db)):
    created = 0
    skipped = 0
    for data in entries:
        entry = Audit(**data.model_dump())
        db.add(entry)
        created += 1
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        skipped = len(entries)
        created = 0
    return {"ok": True, "created": created, "skipped": skipped}


@router.post("/bulk")
async def bulk_upsert_audit(rows: list[AuditCreate], db: AsyncSession = Depends(get_db)):
    upserted = 0
    for data in rows:
        result = await db.execute(select(Audit).where(Audit.id == data.id))
        existing = result.scalar_one_or_none()
        if existing:
            for k, v in data.model_dump(exclude_unset=True).items():
                setattr(existing, k, v)
        else:
            db.add(Audit(**data.model_dump()))
        upserted += 1
    await db.commit()
    return {"ok": True, "upserted": upserted}
