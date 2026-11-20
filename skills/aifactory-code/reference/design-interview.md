# Design interview

Run this before you scaffold anything. Ask in plain language, a few questions at a time, and
use the person's own words in the summary. If they already answered something, do not ask it
again. Recommend the smallest shape that meets the need, then let the person confirm.

## 1. What and who

1. **What should the solution do?** One or two sentences. Who uses it, and how often?
2. **Who signs in?** Only the customer's (or itm8's) own staff, or also people outside the
   organisation? Outside people sign in as guests in the customer's Entra tenant; there are no
   public pages and no own login.
3. **What data does it hold or show?** Ask directly whether there is personal data (names,
   e-mail, phone, personal numbers, employee data) or special-category or regulated data. Yes
   or unknown → stop and ask ([stop-and-ask.md](stop-and-ask.md)) and continue with synthetic data
   only.
4. **Where will it run?** In a customer's workload landing zone (the Wizard builds it) or on
   itm8's shared platform at ai.itm8.cloud (internal itm8 solutions)?
5. **Customer code or data?** If the target is a customer: has the customer recorded consent to
   AI build tools? If not, work only on synthetic data and itm8-owned code.

## 2. Shape

Pick one base kind and only the add-ons the need calls for. Say why for each yes.

| Choice | When | Flag |
|---|---|---|
| Base: **web app** (TypeScript) | People use it in a browser | `--kind web` |
| Base: **AI agent** (Python, Agent Framework) | The agent is the product: a chat with tools, or Python libraries are needed | `--kind agent` |
| Base: **MCP server** (TypeScript) | It only exposes tools or data to Copilot or agents | `--kind mcp` |
| Add-on: **PostgreSQL** | It stores anything beyond the session | `--db` |
| Add-on: **AI calls** | It summarises, drafts, classifies or answers with a Foundry model | `--ai` (needs `--db`) |
| Add-on: **agent with tools** | Inside a web app, the model should look things up and propose changes a person approves | `--agent` (needs `--ai`) |
| Add-on: **MCP endpoint** | Copilot or agents should use the web app's data | `--mcp` (needs `--db`) |
| Add-on: **Microsoft 365 Copilot agent** | People should ask about the app's data from Copilot, Teams or Outlook | `--copilot` (needs `--mcp` or `--kind mcp`) |
| Base: **Copilot agent for an existing MCP server** | The MCP server exists already (ours or a partner's, Entra-protected) | `--kind copilot --mcp-url https://…/mcp` |

A Copilot agent needs each user to have a Microsoft 365 Copilot licence, and a Microsoft 365
admin of the tenant where it runs to approve it. Ask who that admin is.

Most internal tools are a web app with PostgreSQL. Do not add AI because it is possible: add it
because a step in the user's work gets better. Choose the agent add-on over the Python agent when
the agent is one feature of an app; choose the Python agent when the agent is the whole product.

## 3. Names and roles

- **Solution title**: what people call it, sentence case.
- **App name**: `web` unless there is a reason; lowercase letters, digits and hyphens, at most 10
  characters.
- **Roles**: which Entra app roles the app needs (for example `App.Reader`, `App.Admin`) and what
  each may do. Permissions are checked on the server.

## 4. Confirm

Summarise in a short table: purpose, users, data, target, zone assumption (Yellow until itm8
confirms), base kind, add-ons, roles, open "ask itm8" items. Ask the person to confirm or change
it. Only then run the scaffold with matching flags.

After scaffolding, suggest the first feature as a spec (`/aifactory-code:spec`) when it is more
than the starter already does: the design interview shapes the solution, a spec shapes each
feature.
