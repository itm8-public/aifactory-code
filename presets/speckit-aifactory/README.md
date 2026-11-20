# itm8 AI Factory preset for GitHub Spec Kit

For teams that already use [GitHub Spec Kit](https://github.com/github/spec-kit) (`specify`)
and build for the itm8 AI Factory. Teams without Spec Kit use the plugin's own
`/aifactory-code:spec`, `/aifactory-code:plan` and `/aifactory-code:fix` instead: same files,
same gates, no Python tool.

| Spec Kit piece | What the preset does |
|---|---|
| Constitution | Replaced: `AGENTS.md` (the AI Factory build rules) is the constitution; eight principles follow the gates |
| `spec-template` | Appends "Data and zone (AI Factory)" |
| `plan-template` | Appends the AI Factory gates G1 to G7 and the sign-off line |
| `tasks-template` | Ends every task list with the AI Factory build check |
| `speckit.implement` | Wrapped: stops while the gates are unsigned; runs the build check at the end |

Verified with specify-cli 1.2.5.

## Install

In the Spec Kit project (`--dev` copies the preset into `.specify/presets/`, so any copy of the
plugin works; in Claude Code, ask it to install "the aifactory-code Spec Kit preset"):

```
specify preset add constitution-sync
specify preset add --dev <aifactory-code plugin folder>/presets/speckit-aifactory
specify preset resolve plan-template
```

`constitution-sync` (bundled with Spec Kit) lets the preset replace a constitution that is still
as `specify init` wrote it. Leave it out if the team does not want `/speckit-constitution` to
update templates; then, and for a constitution the team has already edited, run
`/speckit-constitution` once to bring the AI Factory principles in.

The `features` list in `.aifactory/build-profile.json` and build-check rule AF-30 read the same
`specs/NNN-slug/` folders, so they work for Spec Kit projects too.

The `spec-template`, `plan-template` and `tasks-template` files are generated from the plugin's
`templates/specs/` by `scripts/build-preset.mjs`; do not edit them here.
