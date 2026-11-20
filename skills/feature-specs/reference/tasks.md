# Tasks

`tasks.md` turns the plan into small steps a person or Claude can do one at a time.

- Format: ``- [ ] T001 [P] [US1] <what> in `<file>` ``. Number in execution order. `[P]` only when
  the task touches different files from the open tasks before it and needs none of them. `[US1]`
  ties a task to a user story; setup, foundational and polish tasks have no story label.
- Phases: Setup, Foundational (migrations, shared types, route registration: blocks every story),
  one phase per user story in priority order, Polish.
- Tests first: in each story phase, the test tasks come before the code tasks. Run the test and
  see it fail before you write the code. Each G7 boundary line gets a refusal test task: it tries
  to cross the boundary (no sign-in, a missing role, another owner's id, bad input, an action
  without approval) and expects the refusal.
- Every task names the file it changes. "Improve error handling" is not a task.
- The last task runs the build check. Add a task to update the evaluation set when agent
  behaviour changes (`evals/agent.json`, AF-26), and the Copilot tool list when MCP tools change
  (`npm run copilot:tools`, AF-28).

## While building

- Work in order; stop at each story's checkpoint and show the person it works.
- Tick a task (`- [x]`) when its code and test are done, then run `feature.mjs sync`.
- When the plan turns out wrong, change `plan.md` first (and the gates if they are affected:
  the person signs again), then the tasks.
