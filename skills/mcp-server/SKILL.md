---
name: mcp-server
description: Build an MCP server for the itm8 AI Factory in TypeScript - a stateless Streamable HTTP endpoint at /mcp behind Easy Auth with a fixed list of read-only, audited tools - either as its own container (--kind mcp) or as an endpoint inside a web app (--mcp). Use when exposing an app's data or tools to Microsoft 365 Copilot, Foundry agents or Claude over MCP, or when a project's .aifactory/build-profile.json has addons.mcp.
---

# Build an AI Factory MCP server

| Shape | When | Files |
|---|---|---|
| `--kind mcp` | The server only offers tools; no pages | `src/server/routes/mcp.ts`, `src/server/lib/mcp-tools.ts`, `src/server/mcp.test.ts` |
| `--mcp` on a web app | The app's own data should be usable from Copilot or agents | the same files inside the web app |

## How it works

- `routes/mcp.ts` answers `GET`, `POST` and `DELETE /mcp` with the MCP SDK's stateless handler
  (`@modelcontextprotocol/server` + `@modelcontextprotocol/node`), one server per request: no
  session state, any replica answers.
- **Sign-in:** like every route, `/mcp` needs the Easy Auth principal. In Azure, Easy Auth must
  accept the caller's bearer token: the app registration exposes an API, and the Wizard's Easy
  Auth `allowedAudiences` includes that audience. Microsoft 365 Copilot (SSO through the token
  store) and Foundry agents acting for a user then reach the app as that user. Locally the
  stand-in user applies.
- **Tools** are a fixed list in `lib/mcp-tools.ts`, each with a zod input schema, a title and a
  description the model reads. All are annotated read-only.
- **Audit:** with a database, every call writes an audit row with the tool name, outcome and a
  SHA-256 of the arguments, never the arguments (questions can name people). Without a database
  the same goes to the log.
- **Cross-site guard:** a browser `Origin` must be the app's own; server-to-server clients send
  none and must send JSON.

## Adding a tool

1. Add a `tool({...})` entry: `name` (snake_case), `title`, a `description` that says what it
   returns and when to use it, an `input` schema with limits and `.describe()` on each field.
2. Return plain JSON. Only what the caller may see; limit rows.
3. Test it in `mcp.test.ts` with `tools/call` (the helper parses JSON and SSE answers).

## Rules

- Read-only by default. A tool that sends, writes or deletes needs a human approval step: build
  it in an app with the agent add-on, or ask itm8.
- Treat tool input as untrusted: validate, cap lengths, never build SQL or URLs from it.
- No secrets in tool results; no personal data unless the zone allows it (Red, after itm8
  confirms).
- Test with an MCP client (for example the MCP Inspector, Streamable HTTP, `http://localhost:8080/mcp`).
- For Microsoft 365 Copilot, add `--copilot` (a declarative agent in `copilot/`, see the
  `copilot-agent` skill). After any tool change run `npm run copilot:tools`: Copilot sees only the
  pinned list. Tokens from Copilot's token store are accepted on `/mcp` only.
