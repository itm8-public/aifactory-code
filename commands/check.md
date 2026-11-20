---
description: Run the AI Factory build check on this project and explain every FAIL and WARN.
argument-hint: "[project folder, default: current folder]"
---

Run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/build-check.mjs" $ARGUMENTS
```

(no argument means the current folder). Then, per the installed plugin's
[`skills/aifactory-code/SKILL.md`](../skills/aifactory-code/SKILL.md):

- For each FAIL: say in one or two plain sentences what is wrong and why the platform needs it,
  then offer the fix. Fix FAILs before anything else when the person agrees.
- For each WARN: say what a person has to decide. Never add a waiver yourself.
- End with the counts and whether the project is ready for hand-over
  ([handover.md](../skills/aifactory-code/reference/handover.md)).
