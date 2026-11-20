---
description: Execute tasks.md within the itm8 AI Factory build rules - signed gates first, the AI Factory build check last.
strategy: wrap
---

## itm8 AI Factory: before you start

- `AGENTS.md` holds the AI Factory build rules. They win over the plan and the tasks.
- Run the change gate in `GUARD.md` before each task: scope, stop and ask, the task's boundary
  lines from gate G7 with their refusal tests, then the smallest change.
- Stop if the AI Factory gates in `plan.md` are not filled in or the line
  `Gates signed off by: <name>, <YYYY-MM-DD>` has no person's name and date. Ask a person to
  review and sign it; never write that line yourself.
- Actions that send, pay, write or delete in other systems are proposals a person approves in
  the app. No infrastructure or deployment code. No `.env` files or secret values.

{CORE_TEMPLATE}

## itm8 AI Factory: when you finish

Run the AI Factory build check (`/aifactory-code:check` with the aifactory-code plugin). Fix
every FAIL and explain every WARN to the person. Then run
`node "<aifactory-code plugin>/scripts/feature.mjs" sync` so `.aifactory/build-profile.json`
lists the feature's status.
