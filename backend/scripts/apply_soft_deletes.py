#!/usr/bin/env python3
"""Convert hard deletes to soft deletes and filter is_deleted rows out of queries.

- In delete endpoints: `await db.delete(x)` + commit  ->  flag is_deleted/deleted_at + commit
- Everywhere except bulk_upsert functions: select(M) -> select(M).where(M.is_deleted.is_(False))
  for models that have the SoftDeleteMixin.
"""
import re
from pathlib import Path

ROUTERS = Path(__file__).parent.parent / "app" / "routers"

SOFT_MODELS = {
    "Plant": "plants.py", "Department": "departments.py", "User": "users.py",
    "Machine": "machines.py", "Reason": "reasons.py", "Action": "actions.py",
    "Project": "projects.py", "Meeting": "meetings.py", "EscalationMatrix": "escalation.py",
}


def process(path: Path, model: str) -> None:
    src = path.read_text()
    lines = src.splitlines(keepends=True)
    out = []
    cur_fn = ""
    needs_datetime = "import datetime" not in src

    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^(?:async )?def (\w+)", line)
        if m:
            cur_fn = m.group(1)
        # 1) hard delete -> soft delete
        dm = re.match(r"^(\s*)await db\.delete\((\w+)\)\s*$", line)
        if dm and cur_fn.startswith("delete_"):
            var = dm.group(2)
            indent = dm.group(1)
            out.append(f"{indent}{var}.is_deleted = True\n")
            out.append(
                f"{indent}{var}.deleted_at = datetime.datetime.now(datetime.timezone.utc)\n"
            )
            i += 1
            continue
        # 2) filter deleted rows out of selects (except inside bulk upserts)
        if not cur_fn.startswith("bulk_upsert"):
            line = re.sub(
                rf"select\({model}\)",
                f"select({model}).where({model}.is_deleted.is_(False))",
                line,
            )
        out.append(line)
        i += 1

    new = "".join(out)
    if needs_datetime and ".is_deleted = True" in new:
        new = new.replace(
            "from sqlalchemy import select",
            "import datetime\nfrom sqlalchemy import select",
            1,
        )
    if new != src:
        path.write_text(new)
        print(f"{path.name}: soft-delete applied for {model}")


for model, fname in SOFT_MODELS.items():
    p = ROUTERS / fname
    process(p, model)
print("done")
