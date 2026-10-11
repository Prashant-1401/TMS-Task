"""JWT-only authentication. The shared API-key path is removed entirely."""
import datetime
import uuid
from typing import Optional

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.models.models import User

security = HTTPBearer(auto_error=False)


def create_token(payload: dict) -> str:
    to_encode = payload.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=settings.jwt_expire_minutes
    )
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Every protected router declares this. JWT bearer only — no API keys."""
    if credentials is None:
        raise HTTPException(
            status_code=401, detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_token(credentials.credentials)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Resolve the JWT subject to a real DB user (soft-deleted users are rejected)."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(credentials.credentials)

    sub = payload.get("sub")
    if sub == "master":
        return {
            "id": "MASTER", "name": "Master Admin", "username": "master",
            "role": "Admin", "email": "", "plant_id": None, "is_admin": True,
        }

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.is_deleted.is_(False), User.username == sub)
        )
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Account not found or inactive")
        return {
            "id": user.id,
            "name": user.name,
            "username": user.username,
            "role": user.role,
            "email": user.email,
            "plant_id": user.plant_id,
            "is_admin": user.role == "Admin" or bool(getattr(user, "master_access", False)),
        }


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return current_user
