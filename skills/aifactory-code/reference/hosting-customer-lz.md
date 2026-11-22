# Hosting: a customer workload landing zone

The Management app Wizard designs the landing zone and generates its Bicep, parameter files and
pipelines (GitHub Enterprise or Azure DevOps). The app repository holds the app only. Source of
truth: the Management App's Wizard templates and Wizard documentation; they win on conflict.

## What the platform gives the app

| Item | Value |
|---|---|
| Host | Azure Container Apps (the only host with a template) |
| App kinds | `web`: reached only through the Application Gateway WAF, Easy Auth on. `api`: internal ingress only. `worker`: no ingress. Default and recommendation: one `web` |
| Port | 8080 (default) |
| Health | One path for liveness and readiness. Set it to `/healthz` in the Wizard (its default is `/` for web) |
| Sign-in | Easy Auth, single tenant (the landing zone's tenant), redirects every request to sign-in; the user arrives in `X-MS-CLIENT-PRINCIPAL`. For an MCP endpoint, Easy Auth's allowed audiences must include the app's API audience so clients can send a bearer token |
| Identity | One user-assigned managed identity per app (`id-<solution>-<app>`), exposed as `AZURE_CLIENT_ID` |
| Settings set by the platform | `APP_ENVIRONMENT`, `AZURE_CLIENT_ID`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSSLMODE=require`, `AZURE_OPENAI_ENDPOINT`, `AZURE_AI_PROJECT_ENDPOINT`, `<API>_URL`; `DB_RUNTIME_ROLES` for the migration job |
| Other settings | Plain values by name; secrets as Key Vault references by name only (the secret must exist first) |
| PostgreSQL | Flexible Server 18, Entra auth only, private endpoint, no extensions. The app has data access only |
| Migrations | At most one migration job per solution, its own identity (`id-<solution>-migrator`), runs before each deploy. In the Wizard set the job's repository to `<solution>/web` and the command to `node dist/migrate.js` (TypeScript) or `python -m app.migrate` (Python agent) |
| AI | Foundry with Data Zone or regional deployments only. Basic: the app has Cognitive Services OpenAI User on the account. Premium: calls go through an API Management AI gateway with token limits, and only `AZURE_OPENAI_ENDPOINT` is set; 429 and 403 are normal answers |
| Gateway | A request finishes within 30 seconds. The WAF can block bodies that look like HTML or SQL |
| Capacity | Basic 0 to 2 replicas (scales to zero), Standard 1 to 3, Premium 2 to 10 |

## Zones as they affect code

| Zone | What changes for the app |
|---|---|
| Green | Internal users, no personal data. The build rules only |
| Yellow | External users or business data, still no personal data. The build rules only; a customer IP allow-list may sit in front in production |
| Red | Personal data allowed after itm8 confirms it. List every outside host the app calls (egress goes through a firewall), keep an audit log of personal-data access, support retention and erasure. Sweden Central only. Customer-managed keys and VPN-only access are platform-side |

## Image and deployment

- One image per app, built in the landing zone's registry with `az acr build`, repository
  `<solution>/<app>`, tag = commit SHA; the pipeline pins the digest.
- Deploy order (pipeline): migrate → what-if → deploy → pin each app to its digest → check that
  sign-in is enforced. The app team never deploys by hand beyond the lowest environment.
- The package's `ai-factory.json` describes the apps. Values for this app: name, kind `web`,
  repository `<solution>/web`, port 8080, health path `/healthz`, settings from `.env.example`,
  Easy Auth on, database and AI as in `.aifactory/build-profile.json`, migration job command
  `node dist/migrate.js`.
