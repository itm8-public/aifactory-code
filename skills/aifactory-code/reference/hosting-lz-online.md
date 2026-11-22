# Hosting: itm8's shared platform (`--target lz-online`)

itm8's own solutions run in a shared workload landing zone, in the EU (Sweden Central), behind
`*.ai.itm8.cloud`. The platform team owns and operates it; ask them for the current platform
details. The app repository holds the app only.

## What is shared

| Item | Value |
|---|---|
| Container Apps environment | Shared, no public access; apps reached through a private endpoint |
| Application Gateway WAF_v2 | Shared, Prevention mode; one listener and backend per app (`<app>.ai.itm8.cloud`). Its probe calls `/` and accepts 200 to 399 and 401, which Easy Auth answers |
| PostgreSQL | Shared Flexible Server 18, Entra auth only, private endpoint; one database and one migrator identity per solution |
| Key Vault, container registry | Shared, private; registry roles scoped to the solution's repository prefix |
| Foundry | A shared Foundry account and project, private endpoint from the landing zone (the platform team gives you the account and project names). EU deployments only (DataZoneStandard or regional Standard) |
| Logs | Container Apps logs to the central Log Analytics workspace |

## AI from an internal app

- Call models through the **project endpoint**, not the account endpoint:
  `https://<foundry-account>.services.ai.azure.com/api/projects/<foundry-project>/openai/v1`,
  token audience `https://ai.azure.com` (use the account and project names the platform team gives
  you). Set it as `AZURE_AI_PROJECT_ENDPOINT` (the project URL without `/openai/v1`).
- The app's managed identity needs Foundry User on the project: the platform team grants it.
- Deployment names are pinned per model (for example a GPT chat model and
  `text-embedding-3-large`); read the one you use from a setting such as `AI_CHAT_DEPLOYMENT`.
- Claude is not available here: Claude models are Global only and are allowed only for agents on
  the separate agent platform account, under an exception itm8 has recorded.

## Getting an app onto the platform

Ask the platform team for: the app's identities (app and migrator), its database and grants, a
registry repository, the Container App with Easy Auth (single tenant, assignment required), the
gateway listener and DNS name, and Foundry access if the app uses AI. Give them the values from
`.aifactory/build-profile.json` and the README (port 8080, health path `/healthz`, settings,
roles, migrate command `node dist/migrate.js`).

Same app code as for a customer landing zone: only the settings differ.
