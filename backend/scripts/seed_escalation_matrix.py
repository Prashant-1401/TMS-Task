"""Idempotent seed of the default escalation matrix (moved out of app startup).

Run once after migrations:
    python -m scripts.seed_escalation_matrix

Builds default L1/L2/L3 tiers from actual users in the database, mirroring the
previous startup behavior, but explicit, logged, and safe to re-run (skips
when the matrix already has rows).
"""
import asyncio
import sys

from sqlalchemy import func, select, text

from app.database import async_session
from app.models.models import EscalationMatrix, User

CHAINS_L1 = [("Supervisor", "HOD"), ("Shift Engineer", "HOD"),
             ("HOD", "Plant Head"), ("Plant Head", "MD")]
CHAINS_L2 = [("Supervisor", "Plant Head"), ("Shift Engineer", "Plant Head"), ("HOD", "MD")]
CHAINS_L3 = [("Supervisor", "MD"), ("Shift Engineer", "MD")]

TIERS = [
    (1, CHAINS_L1, 24, "In-App + Email", '["CRITICAL","WARNING","NORMAL"]', "#E69903"),
    (2, CHAINS_L2, 72, "In-App + Email", '["CRITICAL","WARNING"]', "#E67E22"),
    (3, CHAINS_L3, 168, "In-App + Email", '["CRITICAL"]', "#C0392B"),
]


async def main() -> int:
    async with async_session() as db:
        existing = await db.scalar(select(func.count()).select_from(EscalationMatrix))
        if existing:
            print(f"escalation_matrix already has {existing} rows — nothing to do.")
            return 0

        result = await db.execute(
            select(User.name, User.role).where(User.is_active.is_(True))
        )
        user_by_role: dict[str, list[str]] = {}
        for name, role in result.fetchall():
            user_by_role.setdefault(role, []).append(name)

        tiers = []
        tier_id = 1
        for level, chains, hrs, method, priorities, color in TIERS:
            for from_role, to_role in chains:
                for from_name in user_by_role.get(from_role, []):
                    for to_name in user_by_role.get(to_role, []):
                        tiers.append({
                            "id": f"E{level}-{tier_id}",
                            "level": level,
                            "label": f"L{level}: {from_name} → {to_name}",
                            "from_user": from_name,
                            "target_user": to_name,
                            "from_role": from_role,
                            "target_role": to_role,
                            "overdue_hrs": hrs,
                            "notify_method": method,
                            "priorities": priorities,
                            "color": color,
                            "active": True,
                            "description": f"{from_name} overdue {hrs}h → escalate to {to_name}",
                        })
                        tier_id += 1

        for t in tiers:
            db.add(EscalationMatrix(
                id=t["id"], level=t["level"], label=t["label"],
                from_user=t["from_user"], target_user=t["target_user"],
                from_role=t["from_role"], target_role=t["target_role"],
                overdue_hrs=t["overdue_hrs"], notify_method=t["notify_method"],
                priorities=t["priorities"], color=t["color"],
                active=t["active"], description=t["description"],
            ))
        await db.commit()
        print(f"Seeded {len(tiers)} escalation tiers.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
