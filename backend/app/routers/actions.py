import uuid
import datetime as _dt
import base64
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from app.database import get_db, async_session
from app.models.models import Action, ActionMessage, EscalationMatrix, User, Plant, Department
from app.schemas.schemas import ActionCreate, ActionUpdate, ActionMessageCreate, ActionsEmailReq
from app.middleware.auth import require_auth, get_current_user
from app.services.plant_scoping import scope_by_plant
from app.services.email_service import (
    dispatch_escalation_emails, send_actions_email, dispatch_daily_digests,
    send_completion_request_email, send_completion_confirmed_email, send_completion_rejected_email,
    send_attachment_email,
)
from app.services.google_sheets_service import sync_action_to_sheet, sync_all_actions

router = APIRouter(prefix="/api/actions", tags=["Actions"], dependencies=[Depends(require_auth)])


async def _resolve_ids_to_names(db: AsyncSession, plant_id: str = None, dept_id: str = None, responsible: str = None) -> dict:
    plant_name = ""
    dept_name = ""
    resp_email = ""
    resp_phone = ""
    if plant_id:
        plant_q = await db.execute(select(Plant).where(Plant.id == plant_id))
        plant = plant_q.scalar_one_or_none()
        if plant:
            plant_name = plant.name
    if dept_id:
        dept_q = await db.execute(select(Department).where(Department.id == dept_id))
        dept = dept_q.scalar_one_or_none()
        if dept:
            dept_name = dept.name
    if responsible:
        resp_names = [n.strip() for n in responsible.split(",") if n.strip()]
        if resp_names:
            user_q = await db.execute(select(User).where(User.name == resp_names[0]))
            user = user_q.scalar_one_or_none()
            if user:
                resp_email = user.email or ""
                resp_phone = user.phone or ""
    return {"plant": plant_name, "dept": dept_name, "responsible_email": resp_email, "responsible_phone": resp_phone}


async def _action_to_sheet_dict(db: AsyncSession, action) -> dict:
    names = await _resolve_ids_to_names(db, action.plant_id, action.dept_id)
    return {
        "sn": action.sn, "text": action.text, "responsible": action.responsible,
        "due": str(action.due) if action.due else "", "status": action.status,
        "priority": action.priority, "plant": names["plant"],
        "dept": names["dept"], "created": str(action.created) if action.created else "",
    }


async def _generate_sn(db: AsyncSession) -> str:
    result = await db.execute(
        text("SELECT sn FROM actions WHERE sn ~ '^ACT-[0-9]+$' ORDER BY CAST(REPLACE(sn, 'ACT-', '') AS INTEGER) DESC LIMIT 1")
    )
    row = result.fetchone()
    if row and row[0]:
        try:
            max_num = int(row[0].replace("ACT-", ""))
        except ValueError:
            max_num = 0
    else:
        max_num = 0
    return f"ACT-{max_num + 1:03d}"


async def _check_and_dispatch_escalations_with_db(db):
    tiers_q = await db.execute(
        select(EscalationMatrix).where(EscalationMatrix.active == True)
    )
    tiers = tiers_q.scalars().all()
    if not tiers:
        return

    users_q = await db.execute(select(User))
    all_users = users_q.scalars().all()

    email_by_name = {}
    for u in all_users:
        if u.name and u.email:
            email_by_name[u.name] = u.email

    actions_q = await db.execute(
        select(Action).where(Action.is_deleted.is_(False)).where(
            Action.status.notin_(["COMPLETED", "DROPPED"]),
            Action.due.isnot(None),
            Action.responsible.isnot(None),
            Action.responsible != "",
        )
    )
    open_actions = actions_q.scalars().all()

    now = datetime.now(timezone.utc)
    email_groups = {}

    for action in open_actions:
        try:
            due_dt = datetime.combine(action.due, datetime.max.time()).replace(tzinfo=timezone.utc)
            hrs_overdue = (now - due_dt).total_seconds() / 3600
        except (ValueError, TypeError):
            continue
        if hrs_overdue < 0:
            continue

        resp_names = [n.strip() for n in (action.responsible or "").split(",") if n.strip()]
        for resp_name in resp_names:
            for tier in tiers:
                if (tier.from_user or "").strip() != resp_name:
                    continue
                if hrs_overdue < (tier.overdue_hrs or 0):
                    continue
                tier_priorities = (
                    tier.priorities if isinstance(tier.priorities, list)
                    else [x.strip() for x in tier.priorities.split(",") if x.strip()]
                    if isinstance(tier.priorities, str) and tier.priorities.strip()
                    else ["CRITICAL", "WARNING", "NORMAL"]
                )
                if (action.priority or "NORMAL") not in tier_priorities:
                    continue
                notify = (tier.notify_method or "").lower()
                if "email" not in notify:
                    continue
                target_user = (tier.target_user or "").strip()
                if not target_user:
                    continue
                group_key = f"{target_user}::{tier.level}"
                if group_key not in email_groups:
                    email_groups[group_key] = {
                        "target_user": target_user,
                        "level": tier.level,
                        "actions": [],
                    }
                email_groups[group_key]["actions"].append({
                    "sn": action.sn,
                    "text": action.text,
                    "due": str(action.due),
                    "responsible": action.responsible or "",
                    "priority": action.priority or "NORMAL",
                })

    to_send = []
    for group in email_groups.values():
        target_user = group["target_user"]
        recipient_email = email_by_name.get(target_user)
        if not recipient_email or not group["actions"]:
            continue
        to_send.append({
            "recipients": [recipient_email],
            "level": group["level"],
            "target_user": target_user,
            "actions": group["actions"],
        })

    if to_send:
        dispatch_escalation_emails(to_send)


async def _bg_check_escalations():
    try:
        async with async_session() as db:
            await _check_and_dispatch_escalations_with_db(db)
    except Exception as e:
        print(f"[escalation-trigger] background check failed: {e}")
    # Also sync escalated actions to Google Sheets
    try:
        from app.routers.escalation import _bg_sync_escalated_actions
        await _bg_sync_escalated_actions()
    except Exception as e:
        print(f"[google-sheets] escalated actions sync trigger failed: {e}")


async def _sync_action_bg(action_dict: dict):
    try:
        async with async_session() as db:
            names = await _resolve_ids_to_names(db, action_dict.get("plant_id"), action_dict.get("dept_id"), action_dict.get("responsible"))
            action_dict["plant"] = names["plant"]
            action_dict["dept"] = names["dept"]
            action_dict["responsible_email"] = names["responsible_email"]
            action_dict["responsible_phone"] = names["responsible_phone"]
            action_dict.pop("plant_id", None)
            action_dict.pop("dept_id", None)
            sync_action_to_sheet(action_dict)
    except Exception as e:
        print(f"[google-sheets] background sync failed: {e}")


@router.get("/")
async def list_actions(
    plant_id: str = None,
    dept_id: str = None,
    status: str = None,
    priority: str = None,
    responsible: str = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    # Clamp pagination for 300-500 user scale
    skip = max(0, skip)
    limit = max(1, min(limit, 500))
    q = select(Action).where(Action.is_deleted.is_(False))
    if plant_id:
        q = q.where(Action.plant_id == plant_id)
    if dept_id:
        q = q.where(Action.dept_id == dept_id)
    if status:
        q = q.where(Action.status == status)
    if priority:
        q = q.where(Action.priority == priority)
    if responsible:
        q = q.where(Action.responsible == responsible)
    q = scope_by_plant(q, current_user, Action.plant_id)
    q = q.order_by(Action.created.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/send-daily-digests")
async def send_daily_digests_endpoint(bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    users_q = await db.execute(select(User))
    all_users = users_q.scalars().all()
    email_by_name = {u.name: u.email for u in all_users if u.name and u.email}

    actions_q = await db.execute(
        select(Action).where(Action.is_deleted.is_(False)).where(Action.status.notin_(["COMPLETED", "DROPPED"]))
    )
    open_actions = actions_q.scalars().all()

    grouped: dict[str, list] = {}
    for a in open_actions:
        for name in [n.strip() for n in (a.responsible or "").split(",") if n.strip()]:
            grouped.setdefault(name, []).append({
                "sn": a.sn, "text": a.text,
                "due": str(a.due) if a.due else "",
                "status": a.status, "priority": a.priority,
            })

    digest_groups = [
        {"email": email_by_name[name], "name": name, "actions": actions}
        for name, actions in grouped.items()
        if name in email_by_name
    ]

    if not digest_groups:
        return {"status": "ok", "queued": 0, "reason": "No users with open actions and an email on file"}

    bg.add_task(dispatch_daily_digests, digest_groups)
    return {"status": "ok", "queued": len(digest_groups)}


@router.post("/send-to-email")
async def send_actions_to_email(data: ActionsEmailReq, db: AsyncSession = Depends(get_db)):
    q = select(Action).where(Action.is_deleted.is_(False)).where(Action.responsible == data.responsible)
    if data.status:
        q = q.where(Action.status == data.status)
    q = q.order_by(Action.created.desc())
    result = await db.execute(q)
    actions = result.scalars().all()
    if not actions:
        raise HTTPException(status_code=404, detail="No actions found for this person")
    action_dicts = [
        {"sn": a.sn, "text": a.text, "due": str(a.due) if a.due else "", "status": a.status, "priority": a.priority}
        for a in actions
    ]
    sent = send_actions_email(data.email, data.responsible, action_dicts)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send email")
    return {"ok": True, "count": len(action_dicts)}


@router.get("/{action_id}")
async def get_action(action_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    q = scope_by_plant(select(Action).where(Action.is_deleted.is_(False)), current_user, Action.plant_id)
    q = q.where(Action.id == action_id)
    result = await db.execute(q)
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


@router.post("/")
async def create_action(data: ActionCreate, bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    payload = data.model_dump()
    payload["id"] = str(uuid.uuid4())
    payload["sn"] = await _generate_sn(db)
    if "project" in payload:
        payload["project_name"] = payload.pop("project")
    for k in ("due", "date_of_action", "created", "closed_on"):
        v = payload.get(k)
        if isinstance(v, str):
            try:
                payload[k] = _dt.date.fromisoformat(v)
            except (ValueError, TypeError):
                pass
    action = Action(**payload)
    db.add(action)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        payload["sn"] = await _generate_sn(db)
        action = Action(**payload)
        db.add(action)
        await db.commit()
    await db.refresh(action)
    bg.add_task(_bg_check_escalations)
    action_dict = {
        "sn": action.sn, "text": action.text, "responsible": action.responsible,
        "due": str(action.due) if action.due else "", "status": action.status,
        "priority": action.priority, "plant_id": action.plant_id or "",
        "dept_id": action.dept_id or "", "created": str(action.created) if action.created else "",
    }
    bg.add_task(_sync_action_bg, action_dict)
    return action


# ── Helper: split a multi-person responsible string into individual names ──
def _split_responsible(raw: str) -> list[str]:
    """Split comma / slash / ampersand / 'and' separated names into a list."""
    import re
    parts = re.split(r",|/|&|\band\b", raw or "", flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()]


@router.patch("/{action_id}")
async def update_action(action_id: str, data: ActionUpdate, bg: BackgroundTasks,
                        db: AsyncSession = Depends(get_db),
                        current_user: dict = Depends(get_current_user)):
    # ── Shared helpers ───────────────────────────────────────────────────────
    is_admin = bool(current_user and (current_user.get("role") == "Admin" or current_user.get("is_admin")))
    user_name = current_user.get("name") if current_user else None
    user_name_clean = (user_name or "").strip().lower()

    # ════════════════════════════════════════════════════════════════════════
    # GOOGLE SHEETS PATH
    # ════════════════════════════════════════════════════════════════════════
    # ════════════════════════════════════════════════════════════════════════
    # DATABASE (PostgreSQL) PATH
    # ════════════════════════════════════════════════════════════════════════
    result = await db.execute(
        select(Action).where(Action.is_deleted.is_(False)).where(Action.id == action_id).with_for_update()
    )
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    update_data = data.model_dump(exclude_unset=True)
    if "project" in update_data:
        update_data["project_name"] = update_data.pop("project")

    new_status = update_data.get("status")
    old_status = action.status
    old_pending = action.pending_confirmation
    resp_names = _split_responsible(action.responsible or "")
    resp_names_clean = [n.strip().lower() for n in resp_names]
    alloc_name = (action.allocated_by or "").strip()
    alloc_name_clean = alloc_name.lower()
    is_allocator = bool(user_name_clean and user_name_clean == alloc_name_clean)
    is_responsible = bool(user_name_clean and user_name_clean in resp_names_clean)

    # ── Step 1: Always keep pendingConfirmation in sync with status ──────────
    if new_status == "PENDING CONFIRM":
        update_data["pending_confirmation"] = True
        update_data["closed_on"] = None
    elif new_status in ("COMPLETED", "DROPPED"):
        update_data["pending_confirmation"] = False
        if new_status == "COMPLETED" and not update_data.get("closed_on"):
            update_data["closed_on"] = _dt.date.today()
    elif new_status:
        update_data["pending_confirmation"] = False
        update_data["closed_on"] = None
    elif update_data.get("pending_confirmation") is True:
        # Sending pendingConfirmation=True without status = ignored
        update_data["pending_confirmation"] = False

    # ── Step 2: Permission-gated transition rules ────────────────────────────
    if new_status and new_status != old_status:
        # Rule 1 – request completion (→ PENDING CONFIRM)
        if new_status == "PENDING CONFIRM":
            if user_name_clean and not is_responsible and not is_admin:
                raise HTTPException(status_code=403, detail="Only the responsible user or Admin can request completion")
            update_data["pending_confirmation"] = True
            update_data["closed_on"] = None
            # Notify allocator
            if alloc_name:
                alloc_q = await db.execute(select(User).where(User.name.ilike(alloc_name)))
                allocator = alloc_q.scalar_one_or_none()
                if allocator and allocator.email:
                    bg.add_task(send_completion_request_email, allocator.email,
                                action.sn, action.text, user_name or "Unknown", alloc_name)

        # Rule 2 – confirm completion (PENDING CONFIRM → COMPLETED)
        elif new_status == "COMPLETED" and (old_status == "PENDING CONFIRM" or old_pending):
            if not is_allocator and not is_admin:
                raise HTTPException(status_code=403, detail="Only the allocator or Admin can confirm completion")
            update_data["pending_confirmation"] = False
            update_data["closed_by"] = user_name
            if not update_data.get("closed_on"):
                update_data["closed_on"] = _dt.date.today()
            # Notify all responsible persons
            if resp_names:
                from sqlalchemy import or_
                resp_q = await db.execute(select(User).where(or_(*[User.name.ilike(rn) for rn in resp_names])))
                for resp_user in resp_q.scalars().all():
                    if resp_user and resp_user.email:
                        bg.add_task(send_completion_confirmed_email, resp_user.email,
                                    action.sn, action.text, user_name or "Unknown")

        # Rule 4 – Admin force-complete from any status (bypass PENDING CONFIRM)
        elif new_status == "COMPLETED" and is_admin:
            update_data["pending_confirmation"] = False
            if not update_data.get("closed_on"):
                update_data["closed_on"] = _dt.date.today()
            # Note: closed_by NOT set here (force-complete, not a confirm)

        # Rule 3 – non-privileged user jumps directly to COMPLETED → force PENDING CONFIRM
        elif new_status == "COMPLETED":
            update_data["status"] = "PENDING CONFIRM"
            update_data["pending_confirmation"] = True
            update_data["closed_on"] = None
            if alloc_name:
                alloc_q = await db.execute(select(User).where(User.name.ilike(alloc_name)))
                allocator = alloc_q.scalar_one_or_none()
                if allocator and allocator.email:
                    bg.add_task(send_completion_request_email, allocator.email,
                                action.sn, action.text, user_name or "Unknown", alloc_name)

        # Rule 3b – reject completion (PENDING CONFIRM → IN PROCESS)
        elif new_status == "IN PROCESS" and (old_status == "PENDING CONFIRM" or old_pending):
            if not is_allocator and not is_admin:
                raise HTTPException(status_code=403, detail="Only the allocator or Admin can reject completion")
            update_data["pending_confirmation"] = False
            update_data["closed_on"] = None
            # Notify all responsible persons
            if resp_names:
                from sqlalchemy import or_
                resp_q = await db.execute(select(User).where(or_(*[User.name.ilike(rn) for rn in resp_names])))
                for resp_user in resp_q.scalars().all():
                    if resp_user and resp_user.email:
                        bg.add_task(send_completion_rejected_email, resp_user.email,
                                    action.sn, action.text, user_name or "Unknown")

        # Any other status change: clear pending flag and closedOn
        else:
            update_data["pending_confirmation"] = False
            if new_status not in ("COMPLETED", "DROPPED"):
                update_data.setdefault("closed_on", None)

    elif update_data.get("pending_confirmation") is False and old_pending:
        if not is_allocator and not is_admin:
            raise HTTPException(status_code=403, detail="Only the allocator or Admin can clear pending confirmation")
    # ── End status enforcement ───────────────────────────────────────────────

    if "revision_history" in update_data:
        incoming_history = update_data.pop("revision_history")
        current_history = action.revision_history or []
        if incoming_history and isinstance(incoming_history, list):
            current_history = current_history + incoming_history
        update_data["revision_history"] = current_history
        update_data["revisions"] = (action.revisions or 0) + 1

    # Preserve base64 data in attachments if frontend sends metadata-only list
    if "attachments" in update_data:
        incoming = update_data["attachments"] or []
        existing_atts = {a["id"]: a for a in (action.attachments or []) if "data" in a}
        merged = []
        for att in incoming:
            if att.get("id") in existing_atts and "data" not in att:
                merged.append(existing_atts[att["id"]])
            else:
                merged.append(att)
        update_data["attachments"] = merged

    for k, v in update_data.items():
        if isinstance(v, str) and k in ("due", "date_of_action", "closed_on", "created"):
            try:
                v = _dt.date.fromisoformat(v)
            except (ValueError, TypeError):
                pass
        setattr(action, k, v)
    action.version = (action.version or 0) + 1
    await db.commit()
    await db.refresh(action)
    bg.add_task(_bg_check_escalations)
    action_dict = {
        "sn": action.sn, "text": action.text, "responsible": action.responsible,
        "due": str(action.due) if action.due else "", "status": action.status,
        "priority": action.priority, "plant_id": action.plant_id or "",
        "dept_id": action.dept_id or "", "created": str(action.created) if action.created else "",
    }
    bg.add_task(_sync_action_bg, action_dict)
    return action


@router.delete("/{action_id}")
async def delete_action(action_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Action).where(Action.is_deleted.is_(False)).where(Action.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    action.is_deleted = True
    action.deleted_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    return {"ok": True}


@router.get("/{action_id}/messages")
async def list_action_messages(action_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ActionMessage).where(ActionMessage.action_id == action_id).order_by(ActionMessage.ts)
    )
    return result.scalars().all()


@router.post("/{action_id}/messages")
async def create_action_message(action_id: str, data: ActionMessageCreate, db: AsyncSession = Depends(get_db)):
    msg = ActionMessage(action_id=action_id, **data.model_dump(exclude={"id", "action_id"}))
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.post("/{action_id}/attachments")
async def upload_attachment(action_id: str, file: UploadFile = File(...), bg: BackgroundTasks = None, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Upload an attachment to object storage (S3/R2 or local-disk fallback).

    Only metadata (id, filename, mimetype, size, storage_key) is stored in
    Postgres — never file bytes.
    """
    from app.services import storage as storage_service

    result = await db.execute(select(Action).where(Action.is_deleted.is_(False)).where(Action.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    content = await file.read()
    storage_service.validate_upload(content, file.content_type, file.filename or "unnamed")

    attachment = storage_service.store_attachment(action_id, content, file.content_type, file.filename or "unnamed")

    current = action.attachments or []
    current.append(attachment)
    action.attachments = current
    action.version = (action.version or 0) + 1
    await db.commit()

    # Email notification keeps working; files stream from storage at send time
    if bg and action.allocated_by:
        alloc_q = await db.execute(select(User).where(User.is_deleted.is_(False), User.name == action.allocated_by))
        allocator = alloc_q.scalar_one_or_none()
        if allocator and allocator.email:
            bg.add_task(
                send_attachment_email, allocator.email, action.sn, action.text,
                action.responsible or "Unknown", attachment["filename"],
                attachment["storage_key"], attachment["mimetype"],
            )

    return {"ok": True, "attachment": {k: attachment[k] for k in ("id", "filename", "mimetype", "size")}}


@router.get("/{action_id}/attachments/{attachment_id}")
async def download_attachment(action_id: str, attachment_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Return a short-lived presigned download URL (JWT required).

    S3/R2: 302 redirect to a presigned GET (expires in S3_PRESIGN_EXPIRY_SECONDS).
    Local-disk fallback: streams the bytes (still fully authenticated).
    """
    from app.services import storage as storage_service
    from fastapi.responses import RedirectResponse, Response

    result = await db.execute(select(Action).where(Action.is_deleted.is_(False)).where(Action.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    att = next((a for a in (action.attachments or []) if a.get("id") == attachment_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    url = storage_service.get_download_url(att)
    if url:
        return RedirectResponse(url, status_code=302)
    data = storage_service.read_attachment_bytes(att)
    if data is None:
        raise HTTPException(status_code=404, detail="Attachment file missing from storage")
    return Response(
        content=data,
        media_type=att.get("mimetype", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{att.get("filename", "file")}"'},
    )


@router.delete("/{action_id}/attachments/{attachment_id}")
async def delete_attachment(action_id: str, attachment_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    from app.services import storage as storage_service

    result = await db.execute(select(Action).where(Action.is_deleted.is_(False)).where(Action.id == action_id))
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    current = action.attachments or []
    removed = [a for a in current if a.get("id") == attachment_id]
    if not removed:
        raise HTTPException(status_code=404, detail="Attachment not found")
    action.attachments = [a for a in current if a.get("id") != attachment_id]
    action.version = (action.version or 0) + 1
    await db.commit()
    for a in removed:
        storage_service.delete_attachment_file(a)  # best effort
    return {"ok": True}


@router.post("/bulk")
async def bulk_upsert_actions(rows: list[ActionCreate], bg: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    upserted = 0
    for data in rows:
        payload = data.model_dump()
        if "project" in payload:
            payload["project_name"] = payload.pop("project")
        for k in ("due", "date_of_action", "created", "closed_on"):
            v = payload.get(k)
            if isinstance(v, str):
                try:
                    payload[k] = _dt.date.fromisoformat(v)
                except (ValueError, TypeError):
                    pass
        action_id = payload.get("id")
        if action_id:
            result = await db.execute(select(Action).where(Action.id == action_id))
            existing = result.scalar_one_or_none()
            if existing:
                for k, v in payload.items():
                    if k != "id":
                        setattr(existing, k, v)
                upserted += 1
                continue
        if not payload.get("id"):
            payload["id"] = str(uuid.uuid4())
        if not payload.get("sn"):
            payload["sn"] = await _generate_sn(db)
        db.add(Action(**payload))
        upserted += 1
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        for data in rows:
            payload = data.model_dump()
            if "project" in payload:
                payload["project_name"] = payload.pop("project")
            for k in ("due", "date_of_action", "created", "closed_on"):
                v = payload.get(k)
                if isinstance(v, str):
                    try:
                        payload[k] = _dt.date.fromisoformat(v)
                    except (ValueError, TypeError):
                        pass
            action_id = payload.get("id")
            if action_id:
                result = await db.execute(select(Action).where(Action.id == action_id))
                existing = result.scalar_one_or_none()
                if existing:
                    for k, v in payload.items():
                        if k != "id":
                            setattr(existing, k, v)
                    continue
            payload["id"] = str(uuid.uuid4())
            payload["sn"] = await _generate_sn(db)
            db.add(Action(**payload))
        await db.commit()
    bg.add_task(_bg_check_escalations)
    return {"ok": True, "upserted": upserted}


@router.post("/sync-to-sheet")
async def sync_actions_to_sheet(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Action).where(Action.is_deleted.is_(False)).order_by(Action.created.desc()))
    actions = result.scalars().all()
    action_dicts = []
    for a in actions:
        names = await _resolve_ids_to_names(db, a.plant_id, a.dept_id, a.responsible)
        action_dicts.append({
            "sn": a.sn, "text": a.text, "responsible": a.responsible,
            "responsible_email": names["responsible_email"],
            "responsible_phone": names["responsible_phone"],
            "due": str(a.due) if a.due else "", "status": a.status,
            "priority": a.priority, "plant": names["plant"],
            "dept": names["dept"], "created": str(a.created) if a.created else "",
        })
    success = sync_all_actions(action_dicts)
    if not success:
        return {"ok": False, "error": "Google Sheets not configured or sync failed"}
    return {"ok": True, "synced": len(action_dicts)}
