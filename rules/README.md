# Pinned build rules

`build-kit/` holds a byte-for-byte copy of the AI Factory build rules, mirrored from itm8's
internal AI Factory build-kit and maintained by itm8. This plugin never edits them.

`pin.json` records a SHA-256 per file so the shipped copies can be verified offline.

- `npm run check` fails when a local file no longer matches its pinned hash, when a file is over
  12,000 characters, or when the `## This project` section is missing (the scaffold fills it).

Re-pinning the rules against the upstream repository is an itm8-internal maintenance step and is
not part of this public copy.

`PERFORMANCE.md` and `GUARD.md` are written to the project root unchanged, next to `AGENTS.md`.
When upstream assigns rule ids (`BR-01` and on), map them in
`skills/aifactory-code/reference/rule-ids.md`.
