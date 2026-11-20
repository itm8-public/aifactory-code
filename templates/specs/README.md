# Feature specs

One folder per feature that is more than a small change, numbered in order:

```text
specs/
├── 001-<slug>/
│   ├── spec.md    what and why: user stories, requirements, data and zone, success criteria
│   ├── plan.md    how: technical context, the AI Factory gates (signed off by a person), design
│   └── tasks.md   T001, T002, … with tests first; ticked when done
└── bugs/
    └── B001-<slug>/report.md   symptom, failing test first, root cause, fix, verdict
```

With the aifactory-code plugin in Claude Code:

| Step | Command |
|---|---|
| Describe a feature | `/aifactory-code:spec <what you want>` |
| Plan it and list the tasks | `/aifactory-code:plan <number>` |
| Fix a bug, failing test first | `/aifactory-code:fix <what goes wrong>` |
| Check the project | `/aifactory-code:check` (rule AF-30 warns about open clarifications and unsigned gates) |

Small changes need no spec. `.aifactory/build-profile.json` lists the features under `features`,
derived from these folders.

The structure of these files is adapted from [GitHub Spec Kit](https://github.com/github/spec-kit)
(MIT licence). Teams that use Spec Kit itself can install the itm8 AI Factory preset that ships
with the plugin instead.
