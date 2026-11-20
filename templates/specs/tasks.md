# Tasks: __FEATURE__

- Feature: `__ID__`, plan: [plan.md](plan.md)

<!--
  T001 numbering in order. [P] = can run in parallel (different files, no unfinished dependency).
  [US1] = the user story the task serves. Tests come first and fail before the code that makes
  them pass. Every task names the file it changes. Tick a task (- [x]) when it is done.
-->

## Phase 1: Setup

- [ ] T001 <setup task> in `<file>`

## Phase 2: Foundational (blocks every story)

- [ ] T002 <migration, shared type or route registration> in `<file>`

## Phase 3: User story 1 (P1), the smallest useful slice

- [ ] T003 [P] [US1] Test: <acceptance scenario 1> in `<test file>`
- [ ] T004 [US1] <implementation> in `<file>`

Checkpoint: user story 1 works and is tested on its own.

## Phase 4: User story 2 (P2)

- [ ] T005 [P] [US2] Test: <acceptance scenario> in `<test file>`
- [ ] T006 [US2] <implementation> in `<file>`

## Phase 5: Polish

- [ ] T007 Update the evaluation set, README or settings this feature changed
- [ ] T008 Run the AI Factory build check (`/aifactory-code:check`): fix every FAIL, explain every WARN

## Dependencies

- Phase 2 blocks every story. Stories run in priority order, or in parallel when they touch different files.
