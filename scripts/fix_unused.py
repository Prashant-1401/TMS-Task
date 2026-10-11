#!/usr/bin/env python3
"""Iteratively rename eslint-flagged unused bindings with a _ prefix.

Uses exact eslint JSON positions. Idempotent: run until 0 fixed.
Safe renames only: catch params, array/object destructuring, declarations.
"""
import json
import re
import subprocess
from pathlib import Path

for round_no in range(6):
    r = subprocess.run(["npx", "eslint", "src", "--no-warn-ignored", "-f", "json"],
                       capture_output=True, text=True)
    data = json.loads(r.stdout)
    fixed = 0
    for f in data:
        fp = Path(f["filePath"])
        lines = fp.read_text().splitlines(keepends=True)
        msgs = [m for m in f["messages"] if m["ruleId"] == "no-unused-vars"
                and "is defined but never used" in m["message"]]
        for m in sorted(msgs, key=lambda x: -x["line"]):
            name = m["message"].split("'")[1]
            li, col = m["line"] - 1, m.get("column", 1) - 1
            line = lines[li]
            mo = re.match(r"\s*" + re.escape(name) + r"\b", line[col:])
            if not mo:
                continue
            start = col + mo.start()
            end = start + len(name)
            before = line[:start].rstrip()
            after = line[end:].lstrip()
            prev_ch = before[-1] if before else ""
            nxt_ch = after[0] if after else ""
            if before.endswith("catch ("):
                new_name = "_" + name
            elif prev_ch in "[," and nxt_ch in ",]":
                new_name = "_" + name
            elif prev_ch in "{," and nxt_ch in ",}":
                new_name = name + ": _" + name
            elif prev_ch in "=([{," or prev_ch == "":
                new_name = "_" + name
            else:
                continue
            lines[li] = line[:start] + new_name + line[end:]
            fixed += 1
        fp.write_text("".join(lines))
    print(f"round {round_no}: fixed {fixed}")
    if fixed == 0:
        break
print("converged")
