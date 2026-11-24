# Tests

- Vitest, files next to the code: `src/server/<thing>.test.ts`.
- API tests build the real app with `testApp()` and call it with `app.inject()`; sign in with
  `headers: asUser(USER, ['App.Admin'])`. No mocking of Fastify or the database.
- Database tests use the `app_test` database (created by docker compose; a `postgres` service in
  CI). `src/server/test/global-setup.ts` applies the migrations once; call `resetDb(app.db)` in
  `beforeEach`. Add new tables to `TABLES` in `test/helpers.ts`.
- External services are injected, not mocked by module: `testApp({ ai: fakeClient })`, or pass a
  `fetch` and `credential` to `createAiClient`. Follow that pattern for any new outbound call.
- At least one test per endpoint (happy path, validation, permission) and per migration (the
  table works after `db:migrate`).
- Run everything with `npm run check` (lint, typecheck, tests). CI runs the same plus the build,
  a secret scan, a dependency audit and a container build.

## Pull request verdict

- On a pull request, the last step of CI's `verify` job runs `scripts/pr-verdict.ts` and writes
  `needs-a-person` or `no-escalation` to the job summary, with the reasons (also the step output
  `verdict`).
- A pull request needs a person when it touches identity or access code or configuration, a
  database migration, CI, deployment or infrastructure configuration, or a dependency manifest or
  lock file, or when a check failed or did not run. A check that did not run counts against it.
- The rules are path patterns (`AREAS`) with tests in `scripts/pr-verdict.test.ts`. When you add a
  folder for access, migration or deployment code that the patterns miss, add the pattern and a
  test case.
- It names areas, never file paths. It blocks nothing, deploys nothing and calls no model: there
  is no AI review yet. A person still reviews every pull request the usual way.
- The pull request's own copy of the script runs, so a change to the script is itself a reason. A
  gate that must hold has to run outside the pull request.
- The plugin's build check is not part of CI (the plugin is not in the project). Run
  `/aifactory-code:check`; a pipeline that has its result passes it as `build-check=<result>`.

## No preview environment per pull request

The project has no deploy workflow and must not get one: the build rules keep deploy pipelines
out of the app repository, and build check AF-09 and the code guard stop a workflow that signs in
to Azure. When someone asks for a preview per pull request, say it is an "ask itm8" item. The
landing zone has to provide these first:

- a preview pipeline from the Wizard, with a pipeline identity that a pull request may use (today
  the identities trust named GitHub environments only), limited to the non-production registry
  path and the non-production app;
- the non-production Container App in multiple revision mode, so a labelled preview revision gets
  no normal traffic, or one preview app per pull request;
- a host name people can reach (apps have internal ingress behind the gateway) and its Easy Auth
  redirect URI;
- with a database: a job inside the network that creates and drops a database per pull request on
  the non-production server, and a synthetic seed command in the app (there is none today).

Until then a change is tried in the dev environment after the check passes and the change is
merged (the pipeline deploys dev on every push to `main`), and an experiment is tried in the
sandbox ([environments](../../aifactory-code/reference/environments.md)).
