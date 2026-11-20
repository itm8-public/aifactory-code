"""Runs the evaluation set against the configured Foundry model and the local database.

`uv run python -m evals.run`. Needs the AI settings in the environment and `az login` locally.
Prints a result per case and exits 1 below the pass mark. Uses a synthetic evaluation user.
"""

import asyncio
import json
import sys
from pathlib import Path

from app.agent import create_runner
from app.auth import User
from app.db import create_pool
from app.settings import load_settings
from app.tools import Turn, build_tools

USER = User(id="eval-user-00000000", name="Evaluation user", roles=())


async def main() -> int:
    data = json.loads((Path(__file__).parent / "agent.json").read_text(encoding="utf-8"))
    settings = load_settings()
    runner = create_runner(settings)
    pool = create_pool(settings)
    await pool.open()
    passed = 0
    try:
        for case in data["cases"]:
            turn = Turn(tools_used=[], proposals=[])
            out = await runner([{"role": "user", "content": case["question"]}], build_tools(pool, USER, turn))
            problems = []
            if out.kind != "answer":
                problems.append(f"outcome {out.kind}")
            else:
                problems += [
                    f"did not use {t}" for t in case.get("expectTools", []) if t not in turn.tools_used
                ]
                problems += [f"used {t}" for t in case.get("forbidTools", []) if t in turn.tools_used]
                problems += [
                    f'answer lacks "{w}"'
                    for w in case.get("mustInclude", [])
                    if w.lower() not in out.text.lower()
                ]
                if case.get("expectProposal") and not turn.proposals:
                    problems.append("no proposal")
                limit = case.get("forbidProposalCount")
                if limit is not None and len(turn.proposals) >= limit:
                    problems.append("too many proposals")
            passed += not problems
            status = "FAIL" if problems else "PASS"
            print(f"{status}  {case['question']}" + (f"  ({'; '.join(problems)})" if problems else ""))
    finally:
        await pool.close()
    total = len(data["cases"])
    score = passed / total
    mark = round(data["passMark"] * 100)
    print(f"\nScore {passed}/{total} ({round(score * 100)} %), pass mark {mark} %")
    return 0 if score >= data["passMark"] else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
