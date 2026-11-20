# AI calls to Azure AI Foundry

All model calls go through `src/server/lib/ai.ts`. Keep it that way: one place for the endpoint,
identity, limits and logging.

## Where the call goes

| Setting | Set by | Endpoint used | Token audience |
|---|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | Platform, customer landing zone (Foundry account, or the AI gateway on Premium) | `<endpoint>/openai/v1/chat/completions` | `https://cognitiveservices.azure.com/.default` |
| `AZURE_AI_PROJECT_ENDPOINT` | Platform, or you for itm8's shared platform | `<project endpoint>/openai/v1/chat/completions` | `https://ai.azure.com/.default` |

The first one set wins in that order. `AI_TOKEN_SCOPE` overrides the audience only when itm8
tells you the gateway needs another one. `AI_CHAT_DEPLOYMENT` is the deployment name. Locally,
`az login` gives `DefaultAzureCredential` your identity; without settings the app answers "AI is
not configured".

## Rules

- Azure AI Foundry only, EU Data Zone or regional deployments, with the managed identity. Never
  API keys, never OpenAI.com, Anthropic, Gemini or another provider directly, never from the
  browser. Claude in Foundry is Global only and is not available to apps.
- A content-filter result and a 429 are normal answers: show a clear message; retry a 429 after
  its `retry-after`. `ai.ts` returns them as outcomes, not errors.
- Per-user limit per hour, counted in PostgreSQL (`ai_usage`), keyed on the object id.
- Never log prompts or answers with user content. Do not ask the provider to store completions.
- Tell people when they talk to an AI and label generated content (the Ask page does both).
- The model may only call tools from a fixed list in code. Before a tool sends, pays, writes or
  deletes, the code waits for a person to approve. A prompt instruction is not enough. For tool
  calling, use the agent add-on (`--agent`) and the `foundry-agent` skill.
- Calls time out at 25 seconds to stay inside the gateway's 30. Streaming through the gateway is
  untested; for long generations, start the work and poll.

## Evaluation

Keep an evaluation set in `evals/`: at least 20 synthetic questions with the expected answer or
what a good answer must contain, and a command that scores them (for example `npm run eval`).
itm8 runs it before each release. No real customer data in it.
