"""Object storage for attachments — S3-compatible (Cloudflare R2 / AWS S3 / MinIO).

Two backends:
  - S3Storage  — configured via S3_* settings; uploads use presigned PUT,
                 downloads use short-lived presigned GET URLs.
  - LocalStorage — fallback when S3 is not configured (dev/self-hosted);
                 files land under ./data/attachments and downloads are
                 served by an authenticated route.

No file bytes are ever stored in Postgres — only metadata
{id, filename, mimetype, size, storage_key}.
"""
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger("tms.storage")

CHUNK = 1024 * 1024


class StorageError(Exception):
    pass


class S3Storage:
    def __init__(self) -> None:
        import boto3  # lazy import
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )
        self.bucket = settings.s3_bucket

    def key_for(self, action_id: str, attachment_id: str, filename: str) -> str:
        safe = os.path.basename(filename or "file").replace("\x00", "")[:120]
        return f"attachments/{action_id}/{attachment_id}/{safe}"

    def upload_bytes(self, key: str, data: bytes, mimetype: str) -> None:
        from botocore.exceptions import BotoCoreError, ClientError
        try:
            self._client.put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType=mimetype
            )
        except (BotoCoreError, ClientError) as e:
            logger.exception("S3 upload failed for %s", key)
            raise StorageError("File storage upload failed") from e

    def presign_get(self, key: str, filename: str) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ResponseContentDisposition": f'attachment; filename="{filename}"',
            },
            ExpiresIn=settings.s3_presign_expiry_seconds,
        )

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except Exception:
            logger.exception("S3 delete failed for %s", key)


class LocalStorage:
    """Dev/self-host fallback. Files stored under S3_LOCAL_DIR (default ./data/attachments)."""

    def __init__(self) -> None:
        self.root = Path(os.getenv("S3_LOCAL_DIR", "data/attachments")).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return (self.root / key).resolve()

    def key_for(self, action_id: str, attachment_id: str, filename: str) -> str:
        safe = os.path.basename(filename or "file").replace("\x00", "")[:120]
        return f"{action_id}/{attachment_id}/{safe}"

    def upload_bytes(self, key: str, data: bytes, mimetype: str) -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def presign_get(self, key: str, filename: str) -> str:
        # Local backend has no presigning; the authenticated download endpoint
        # streams the file instead.
        return ""

    def delete(self, key: str) -> None:
        p = self._path(key)
        if p.is_file():
            p.unlink(missing_ok=True)

    def read_bytes(self, key: str) -> Optional[bytes]:
        p = self._path(key)
        if not p.is_file():
            return None
        return p.read_bytes()


_backend: Optional[object] = None


def get_storage():
    global _backend
    if _backend is None:
        if settings.s3_bucket and settings.s3_access_key_id and settings.s3_secret_access_key:
            _backend = S3Storage()
        else:
            logger.warning(
                "S3 not configured — using local-disk attachment storage. "
                "Set S3_* vars for production (Cloudflare R2 recommended)."
            )
            _backend = LocalStorage()
    return _backend


def validate_upload(content: bytes, content_type: Optional[str], filename: str) -> None:
    """Enforce size + MIME limits centrally. Raises 400 on violation."""
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds {settings.max_upload_bytes // (1024 * 1024)} MB limit",
        )
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime and mime not in settings.upload_mimes:
        raise HTTPException(status_code=400, detail=f"File type '{mime}' is not allowed")
    if not mime:
        raise HTTPException(status_code=400, detail="Missing file content type")
    if not filename or not filename.strip():
        raise HTTPException(status_code=400, detail="Missing file name")


def store_attachment(action_id: str, content: bytes, mimetype: str, filename: str) -> dict:
    """Upload to object storage and return the DB metadata dict (no bytes)."""
    import base64
    # Sniff a few known magic bytes as a second line of defense against spoofed types
    _check_magic(content, mimetype, filename)

    attachment_id = uuid.uuid4().hex
    storage = get_storage()
    key = storage.key_for(action_id, attachment_id, filename)
    storage.upload_bytes(key, content, mimetype)
    return {
        "id": attachment_id,
        "filename": os.path.basename(filename),
        "mimetype": mimetype,
        "size": len(content),
        "storage_key": key,
        "stored_at": _utcnow_iso(),
    }


def get_download_url(attachment: dict) -> str:
    """Presigned URL (S3) or empty string (local backend streams via API)."""
    if not attachment.get("storage_key"):
        return ""
    storage = get_storage()
    if isinstance(storage, LocalStorage):
        return ""
    return storage.presign_get(attachment["storage_key"], attachment.get("filename", "file"))


def read_attachment_bytes(attachment: dict) -> Optional[bytes]:
    """Only used by the local-disk backend's authenticated download route."""
    storage = get_storage()
    if isinstance(storage, LocalStorage) and attachment.get("storage_key"):
        return storage.read_bytes(attachment["storage_key"])
    return None


def delete_attachment_file(attachment: dict) -> None:
    key = attachment.get("storage_key")
    if not key:
        return
    try:
        get_storage().delete(key)
    except Exception:
        logger.exception("Failed deleting storage object %s", key)


def _utcnow_iso() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


_MAGIC = {
    b"%PDF": "application/pdf",
    b"\x89PNG": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"GIF8": "image/gif",
    b"PK\x03\x04": None,  # xlsx/docx — both zip; can't distinguish cheaply, allow
}


def _check_magic(content: bytes, mime: str, filename: str) -> None:
    """Light magic-byte validation for the riskiest types."""
    try:
        if mime == "application/pdf" and not content.startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="File content does not match declared PDF type")
        if mime in ("image/png",) and not content.startswith(b"\x89PNG"):
            raise HTTPException(status_code=400, detail="File content does not match declared PNG type")
        if mime in ("image/jpeg", "image/jpg") and not content.startswith(b"\xff\xd8\xff"):
            raise HTTPException(status_code=400, detail="File content does not match declared JPEG type")
        if mime == "text/csv" and b"\x00" in content[:1024]:
            raise HTTPException(status_code=400, detail="File content does not match declared CSV type")
    except HTTPException:
        raise
    except Exception:
        pass  # never block on validation infrastructure errors
