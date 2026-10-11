"""One-time migration: move legacy base64 attachments from the DB to object storage.

Walks every action whose attachments contain a "data" (base64) field, uploads
the bytes to S3/R2 (or local-disk fallback), rewrites the attachment metadata
to the new shape {id, filename, mimetype, size, storage_key, stored_at}, and
drops the base64 payload from the row.

Run once after configuring S3_* and running migrations:
    python -m scripts.migrate_base64_attachments [--dry-run]
"""
import asyncio
import base64
import json
import sys

from sqlalchemy import select

from app.database import async_session
from app.models.models import Action
from app.services import storage as storage_service


async def main() -> int:
    dry_run = "--dry-run" in sys.argv
    moved = skipped = failed = 0

    async with async_session() as db:
        result = await db.execute(select(Action).where(Action.is_deleted.is_(False)))
        actions = result.scalars().all()
        for action in actions:
            atts = action.attachments or []
            if not isinstance(atts, list):
                continue
            changed = False
            new_atts = []
            for a in atts:
                if not isinstance(a, dict) or not a.get("data"):
                    new_atts.append(a)
                    continue
                try:
                    raw = base64.b64decode(a["data"])
                    if dry_run:
                        print(f"[dry-run] would move {a.get('filename')} "
                              f"({len(raw)} bytes) on action {action.id}")
                        moved += 1
                        continue
                    attachment = storage_service.store_attachment(
                        action.id, raw,
                        a.get("mimetype", "application/octet-stream"),
                        a.get("filename", "unnamed"),
                    )
                    new_atts.append(attachment)
                    moved += 1
                    changed = True
                    print(f"moved {a.get('filename')} on action {action.id}")
                except Exception as e:
                    failed += 1
                    print(f"FAILED {a.get('filename')} on action {action.id}: {e}")
                    new_atts.append(a)  # keep original data, retry later
            if changed:
                action.attachments = new_atts
                await db.commit()
            else:
                skipped += 1

    print(json.dumps({"moved": moved, "unchanged_actions": skipped, "failed": failed,
                      "dry_run": dry_run}, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
