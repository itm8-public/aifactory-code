# __TITLE__

Built for the itm8 AI Factory with the `aifactory-code` plugin (__PLUGIN_VERSION__, build rules
__KIT_VERSION__). Follow `AGENTS.md`; `.aifactory/build-profile.json` records the design.

## Run it locally

Needs Node 22.9 or later.
<!-- @if db -->
Also Docker, for the local PostgreSQL.
<!-- @endif -->

```bash
cp .env.example .env
npm install
```
<!-- @if db -->

```bash
npm run db:up
npm run db:migrate
```
<!-- @endif -->

```bash
npm run dev
```

<!-- @if spa -->
Open http://localhost:5173. Locally a stand-in user replaces Easy Auth (`DEV_AUTH_BYPASS=true`
in `.env`); the app refuses that setting in Azure.
<!-- @endif -->
<!-- @if !spa -->
The MCP endpoint is http://localhost:8080/mcp. Locally a stand-in user replaces Easy Auth
(`DEV_AUTH_BYPASS=true` in `.env`); the app refuses that setting in Azure. Try it with an MCP
client such as the MCP Inspector (Streamable HTTP transport).
<!-- @endif -->

| Command | What it does |
|---|---|
<!-- @if spa -->
| `npm run dev` | Server on :8080 (restarts on change) and the front end on :5173 |
<!-- @endif -->
<!-- @if !spa -->
| `npm run dev` | Server on :8080, restarts on change |
<!-- @endif -->
| `npm run check` | Lint, typecheck and tests |
| `npm run build` | Server bundle in `dist/`<!-- @if spa -->, front end in `dist/public/`<!-- @endif --> |
| `npm start` | Runs the built app on :8080 |
<!-- @if db -->
| `npm run db:up` / `db:down` | Local PostgreSQL in Docker (port `PGPORT`, default 55432; databases `app` and `app_test`) |
| `npm run db:generate` | New SQL migration in `drizzle/` from `src/server/db/schema.ts` |
| `npm run db:migrate` | Applies the migrations locally |
<!-- @endif -->
<!-- @if agent -->
| `npm run eval` | Runs the assistant's evaluation set (`evals/agent.json`) against Foundry; needs the AI settings and `az login` |
<!-- @endif -->
<!-- @if copilot -->
| `npm run copilot:tools` / `copilot:check` | Pins the MCP tools into the Copilot package / fails while they differ |
<!-- @endif -->

## Pull request checks

CI (`.github/workflows/ci.yml`) runs the secret scan, lint, typecheck, tests, build, dependency
audit and a container build on every pull request. Its last step writes a verdict to the job
summary: `needs-a-person` or `no-escalation`, with the reasons.

A pull request needs a person when it touches identity or access code or configuration, a database
migration, CI, deployment or infrastructure configuration, or a dependency manifest or lock file,
or when a check failed or did not run. The rules are path patterns in `scripts/pr-verdict.ts`, with
tests next to it. The verdict names areas, never files. It blocks nothing, it is no review, and no
AI reads the change. CI deploys nothing.

## The app

| Item | Value |
|---|---|
<!-- @if spa -->
| App | `__APP__`, kind `web`: one container serves the front end and `/api` |
<!-- @endif -->
<!-- @if !spa -->
| App | `__APP__`, kind `web`: one container, an MCP server at `/mcp` |
<!-- @endif -->
| Port | 8080 |
| Health path | `/healthz` (no sign-in, no database)<!-- @if db -->; `/readyz` also checks the database<!-- @endif --> |
| Sign-in | Easy Auth in front of the app; the server reads `X-MS-CLIENT-PRINCIPAL` |
<!-- @if db -->
| Database | PostgreSQL, Entra token auth, data access only |
| Migrate command | `node dist/migrate.js` (same image, run as the migration job) |
<!-- @endif -->
<!-- @if ai -->
| AI | Azure AI Foundry, chat deployment from `AI_CHAT_DEPLOYMENT` |
<!-- @endif -->
<!-- @if agent -->
| Assistant | `/assistant`: the model reads with tools and only proposes actions; a person approves each one before the server runs it |
<!-- @endif -->
<!-- @if mcp -->
| MCP | `/mcp`, stateless Streamable HTTP, read-only tools in `src/server/lib/mcp-tools.ts`, every call audited |
<!-- @endif -->
<!-- @if copilot -->
| Copilot agent | `copilot/`: a Microsoft 365 Copilot declarative agent that calls `/mcp` with the user's Entra SSO token; the tool list is pinned (`npm run copilot:tools`), see `copilot/README.md` |
<!-- @endif -->

### Settings

All names are in `.env.example`. The platform sets `APP_ENVIRONMENT` and `AZURE_CLIENT_ID`.
<!-- @if db -->
It also sets the `PG*` names, and `DB_RUNTIME_ROLES` for the migration job.
<!-- @endif -->
<!-- @if ai -->
In a customer landing zone it sets the Foundry endpoint too.
<!-- @endif -->

| Setting | Kind | Purpose |
|---|---|---|
| `LOG_LEVEL` | plain | Log level, default `info` |
| `APP_PUBLIC_ORIGIN` | plain, optional | Public origin for the cross-site guard |
<!-- @if ai -->
| `AI_CHAT_DEPLOYMENT` | plain | Model deployment name |
| `AI_REQUESTS_PER_USER_PER_HOUR` | plain, optional | Per-user AI limit, default 30 |
<!-- @endif -->

### Roles

| Entra app role | May |
|---|---|
<!-- @if spa -->
<!-- @if db -->
| (any signed-in user) | Use the app, read and add items<!-- @if agent -->, approve or reject what the assistant proposed for them<!-- @endif --> |
| `App.Admin` | Everything, including deleting items |
<!-- @endif -->
<!-- @if !db -->
| (any signed-in user) | Use the app |
| `App.Admin` | Everything |
<!-- @endif -->
<!-- @endif -->
<!-- @if !spa -->
| (any signed-in user) | Call the MCP tools |
| `App.Admin` | Everything |
<!-- @endif -->

### Outside services

None. List every outside host the app calls here (it is needed for the Red zone allow-list).

## Hand-over values

For the Management app Wizard (customer landing zone) or the platform team (itm8's shared
platform):

| Field | Value |
|---|---|
| App, kind | `__APP__`, `web` |
| Image repository | `<solution>/__APP__` |
| Port, health path | 8080, `/healthz` |
| Easy Auth | On<!-- @if mcp -->; allowed audiences include the app's API audience, so MCP clients can call `/mcp` with a bearer token<!-- @endif --><!-- @if copilot -->, and the Application ID URI of the Copilot SSO registration (`copilot/README.md`)<!-- @endif --> |
<!-- @if db -->
| Database | Yes |
| Migration job | Repository `<solution>/__APP__`, command `node dist/migrate.js` |
<!-- @endif -->
<!-- @if ai -->
| AI | Yes |
<!-- @endif -->
| Settings, roles | As above |
