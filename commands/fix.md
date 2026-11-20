---
description: Fix a bug the safe way - a report in specs/bugs/, a failing test that reproduces it first, the smallest fix, then a verdict.
argument-hint: "<what goes wrong>"
---

Read the installed plugin's [`skills/feature-specs/SKILL.md`](../skills/feature-specs/SKILL.md)
and [`reference/bug-fix.md`](../skills/feature-specs/reference/bug-fix.md) before acting.

The bug: $ARGUMENTS

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/feature.mjs" bug --title "<short title>"` in the project
root and fill in the symptom and reproduction. Write a test that reproduces the bug and run it:
it must fail before you change any code. Then find the root cause, make the smallest fix, run the
new test, the whole suite and the build check, and set the verdict (verified, partial or failed)
from what you actually ran. Use synthetic data only. If the bug exposed data to the wrong people,
tell the person first: it may be an incident.
