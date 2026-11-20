---
description: Take a finished change to a pull request in plain steps (check, commit, push, open the pull request, explain the gate's result). Never merges or deploys.
argument-hint: "[what the change does, in one line]"
---

Read the installed plugin's [`skills/aifactory-code/SKILL.md`](../skills/aifactory-code/SKILL.md)
first. The person may not be a developer: use plain words, one step at a time, and say what each
step does before running it.

1. **Look.** Run `git status` and `git diff --stat`. Summarise the change in two or three plain
   sentences. If something unrelated or unexpected is in it (a .env file, generated files, a large
   deletion), stop and ask.
2. **Check locally.** Run the project's tests (the `test-command` in
   `.github/workflows/aifactory-gate.yml`, or the test script in package.json) and the build check:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/build-check.mjs"`. Explain any failure and offer to fix it;
   do not continue with a failing test unless the person decides to.
3. **Production readiness (zone-aware).** Read the zone from `.aifactory/build-profile.json`.
   - **Green** (internal, no personal data): confirm the free checks pass — the build check is
     clean and CI is green (lint, typecheck, tests, build, secret scan, dependency audit) — and
     move on. Add no owner sign-off and no extra gate; Green stays fast.
   - **Yellow or Red**: walk
     [`reference/production-readiness.md`](../skills/aifactory-code/reference/production-readiness.md)
     with the person — the production-readiness checklist, a named system owner and business owner,
     the security requirements verified against their acceptance criteria, and the five
     POC-to-production gates surfaced. Record open items; a person confirms. Never sign off or
     waive on your own.
4. **Branch and commit.** If on main, create a branch named after the change (`change/<short-name>`).
   Commit with a message from: $ARGUMENTS. The secret check runs on commit; if it stops the commit,
   explain the finding and help remove the value. Never bypass it (no `--no-verify`).
5. **Push and open the pull request** after the person says yes: `git push -u origin <branch>`, then
   `gh pr create --base main --fill` (or show the link the push printed when `gh` is not available).
6. **Explain the gate.** Wait for the check `gate / verdict` (`gh pr checks --watch`), then read the
   job summary and say what it means:
   - pass: the change can be merged;
   - fail: what to fix, file by file, and offer to fix it;
   - needs-person: the itm8 review team looks at it; nothing to do but wait (say why it needs a person).
7. Stop there. Never merge, approve, deploy or change repository settings, rulesets or the gate files.
