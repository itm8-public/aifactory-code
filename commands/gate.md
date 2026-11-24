---
description: Install the itm8 AI Factory gate in this repository (required check before merge, secret check before every commit).
argument-hint: "[zone: green, yellow or red]"
---

Read the installed plugin's [`skills/aifactory-code/SKILL.md`](../skills/aifactory-code/SKILL.md)
first. Installing the gate changes CI files, so it is on the stop-and-ask list: explain what will
be written and get a clear yes before running anything.

1. Ask for anything missing, one question at a time, with your suggestion first:
   - the zone (green, yellow or red) as registered for the solution: $ARGUMENTS;
   - the responsibility level (default 2: the customer changes, itm8 approves);
   - the test command (look in package.json or pyproject.toml and suggest it; empty means no tests);
   - the itm8 review team handle for CODEOWNERS (itm8 gives it at onboarding).
2. Say in plain words what the gate does: every pull request runs the tests and three scanners, and
   a fixed rule decides pass, fail or "needs a person"; nothing reaches main without it. A secret
   check also stops commits that add a secret or a .env file.
3. Run:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/install-gate.mjs" --dir . --zone <zone> --level <level> --test-command "<command>" --owner <handle>
   ```

4. Show the files it wrote. Do not commit or push unless the person asks; suggest
   `/aifactory-code:submit` to open the pull request. Say that itm8 turns on the ruleset and the dev
   and prod environments after the pull request is merged. From then on a change reaches dev only
   through a pull request, this check and the pipeline.
