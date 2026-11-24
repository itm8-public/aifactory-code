# Hand over to itm8

Before the solution goes to the Wizard (customer landing zone) or the platform team (itm8's
shared platform), and before the Replatform agent or a reviewer looks at it:

1. `build-check` shows no FAIL, and every WARN has a person's answer or a waiver.
2. The checklist at the end of `AGENTS.md` ("Before you hand over") is ticked.
3. `.aifactory/build-profile.json` is current: apps, database, AI, zone assumption, open
   `askItm8` items with who was asked.
4. The README lists the apps, every setting (plain or secret), the Entra app roles and what each
   may do, the migrate command, and every outside host the app calls.
5. The CI workflow passes on the default branch: lint, typecheck, tests, build, secret scan,
   dependency audit.
6. With an agent: the evaluation (`npm run eval` or `uv run python -m evals.run`) runs against
   the real model and its score, at or above the pass mark, is recorded. Every action tool only
   proposes, and the approval flow is tested.
7. With MCP: the README names the tools, and the Easy Auth allowed audiences for bearer-token
   clients are part of the hand-over values.
8. The checklist in `GUARD.md` is ticked: every trust boundary has a refusal test that passes, and
   a full audit with the `security-audit` skill ran on the source. Each confirmed finding is fixed
   or accepted in writing by a person; its report stays outside the repository.
9. For **Yellow or Red**: the production-readiness checklist in
   [production-readiness.md](production-readiness.md) is walked — a named system owner and business
   owner, the security requirements verified against their acceptance criteria, and the five
   POC-to-production gates surfaced — with open items recorded. Green needs only the free checks above.

What itm8 does next:

- **Customer landing zone:** the delivery lead enters the solution in the Wizard with the values
  from the README (`healthPath: /healthz`, migration job repository `<solution>/web`, command
  `node dist/migrate.js`), a person confirms the zone, and the generated pipelines deploy it: dev
  on every push to `main`, production with an approval from a person.
- **itm8's shared platform:** the platform team sets up identities, database, Container App,
  gateway listener and Foundry access (see [hosting-lz-online.md](hosting-lz-online.md)).

The build check is guidance, not a gate. The Replatform agent's checks and the human approvals
remain the gate; an app built with this plugin just has far fewer findings.
