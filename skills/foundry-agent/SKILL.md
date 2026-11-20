---
name: foundry-agent
description: Build an AI agent for the itm8 AI Factory on Azure AI Foundry models - either the agent add-on of a TypeScript web app or a standalone Python agent on Microsoft Agent Framework - with a fixed tool list, actions that wait for human approval, per-user limits and an evaluation set. Use for agents, assistants, chatbots, tool calling, model choice (GPT or Claude), evaluations and approval flows in a project whose .aifactory/build-profile.json has addons.agent, or when someone asks for an agent on AI Factory.
---

# Build an AI Factory agent

Two shapes, both one container on port 8080 behind Easy Auth:

| Shape | When | Where the code is |
|---|---|---|
| **Agent add-on** to a web app (`--agent`, TypeScript) | People use the agent inside an app that also has pages and data | `src/server/lib/agent.ts`, `lib/agent-tools.ts`, `routes/agent.ts`, `src/web/pages/AgentPage.tsx` |
| **Python agent** (`--kind agent`) | The agent is the product: a chat with tools, Python libraries, Microsoft Agent Framework | `app/agent.py` (the only module importing Agent Framework), `app/tools.py`, `app/main.py`, `app/static/` |

Both run **inside the landing zone as a container**, so they reach private services (PostgreSQL,
private MCP servers, internal APIs). A Foundry *hosted* agent is not templated: it cannot reach
private-only services and is only for agents whose every tool is public or behind Entra
application proxy. Ask itm8 first ([reference/hosting.md](reference/hosting.md)).

## The rules that make it safe

1. **Fixed tools in code.** The model can call only the tools in the list. No tool loads code,
   runs shell commands, fetches arbitrary URLs or builds SQL from model text.
2. **Read or propose, never act.** A read tool returns data. Anything that sends, pays, writes or
   deletes is an *action*: the tool only stores a proposal (`agent_actions`, status `pending`);
   the user approves or rejects it in the app; then the **server** runs it, in one transaction with
   an audit row. A prompt instruction is never the control.
   ([reference/tools-and-approval.md](reference/tools-and-approval.md))
3. **Foundry only, EU deployments, managed identity.** No keys, no OpenAI.com or Anthropic API,
   nothing from the browser ([reference/models.md](reference/models.md)).
4. **Bounded.** At most 4 model steps and 25 seconds per request (the gateway stops at 30). The
   browser keeps the conversation (last 20 turns); the server stores no chat history, so any
   replica answers. Per-user hourly limit in PostgreSQL.
5. **Normal failures are answers.** Content filter, 429 and "not configured" are shown as clear
   messages, not errors.
6. **Never log prompts or answers.** Log request ids, tool names and outcomes only.
7. **Tell people.** The page says they talk to an AI, labels generated text and shows what waits
   for approval.
8. **Evaluate.** `evals/agent.json` holds at least 20 synthetic cases; `npm run eval` (TypeScript)
   or `uv run python -m evals.run` (Python) scores them against the real model. Run it before every
   hand-over and after any prompt, tool or model change ([reference/evals.md](reference/evals.md)).

## Adding a tool

1. Decide: read or action. When unsure, it is an action.
2. TypeScript: add an entry to `AGENT_TOOLS` in `lib/agent-tools.ts` with a zod `input`. Python:
   add an async function in `build_tools` (read) or an `Action` in `ACTIONS` plus a proposing
   function (action).
3. Check permissions inside the tool for the signed-in user; the tool runs for that user only.
4. Add tests with the scripted fake model (`agent.test.ts` / `tests/test_api.py`): the tool is
   used, an action changes nothing until approved, another user cannot approve.
5. Add evaluation cases that need the tool, and run the evaluation.

## Stop and ask

AI that decides about people (hiring, credit, grading), acts in other systems without a person,
or works on personal data: stop and ask itm8 (EU AI Act, DPIA, Red zone). See the core skill's
stop-and-ask list.
