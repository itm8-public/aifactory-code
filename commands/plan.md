---
description: Plan a specified feature - plan.md with the AI Factory gates for a person to sign off, and tasks.md with tests first.
argument-hint: "[feature number, default: the newest]"
---

Read the installed plugin's [`skills/feature-specs/SKILL.md`](../skills/feature-specs/SKILL.md),
[`reference/plan-and-gates.md`](../skills/feature-specs/reference/plan-and-gates.md) and
[`reference/tasks.md`](../skills/feature-specs/reference/tasks.md) before acting.

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" plan $ARGUMENTS` in the project root. If it
refuses because of open clarifications, ask those questions and stop; do not remove a marker
without the person's answer or their accepted assumption.

Then fill `plan.md` (summary, technical context, gates before and after the design, design,
structure) and `tasks.md` (tests first, a file per task, the build check last). Show the gates
table and ask a person to review it and write the sign-off line themselves. Never write the
sign-off line, and start no build task until it is there. Finish with
`node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" sync`.
