# Where agents run

| Option | Reaches private services | Templated | Use |
|---|---|---|---|
| Container in the landing zone (this plugin) | Yes | Yes | Default for every agent |
| Foundry hosted agent (itm8 agent platform account) | No: tool calls leave through Foundry's public network | No | Only when every tool is public or behind Entra application proxy, for example Work IQ or an app-proxied MCP server. Ask itm8 |
| Foundry prompt agent | No | No | Ask itm8 |

A container agent is an ordinary `web` app for the Wizard: port 8080, `/healthz`, Easy Auth,
PostgreSQL with a migration job (`python -m app.migrate` for the Python agent), AI on.

Agents that act for many users or on a schedule (background agents) need a named owner, a run
history and a kill switch; scheduled work is still an "ask itm8" item.
