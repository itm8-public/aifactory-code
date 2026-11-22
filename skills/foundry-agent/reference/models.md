# Models and endpoints

| Setting | Customer landing zone | itm8's shared platform |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | Set by the platform: the Foundry account, or the AI gateway on Premium | Not used |
| `AZURE_AI_PROJECT_ENDPOINT` | Set by the platform with direct AI | You set it: `https://<foundry-account>.services.ai.azure.com/api/projects/<foundry-project>` (the names the platform team gives you) |
| `AI_CHAT_DEPLOYMENT` | The deployment itm8 creates for the solution | A pinned EU deployment (ask the platform team which) |
| Identity | The app's managed identity | The app's managed identity with Foundry User on the project |

When `AZURE_OPENAI_ENDPOINT` is set it wins. TypeScript calls `<endpoint>/openai/v1/chat/completions`
with an Entra token (`https://cognitiveservices.azure.com/.default` or, for the project endpoint,
`https://ai.azure.com/.default`). Python uses Agent Framework's `OpenAIChatClient(azure_endpoint=…)`
or `FoundryChatClient(project_endpoint=…)` with `DefaultAzureCredential`.

## Which model

- **GPT models in the EU** (DataZoneStandard or regional Standard) are the default.
- **Never** a Global deployment, a model from outside Azure, or a preview model, unless itm8 has
  recorded an exception (itm8's AI processing policy).
- **Claude** in Foundry is Global only. It is allowed only for hosted agents on itm8's separate
  agent platform account, under an exception itm8 has recorded, and never with Microsoft 365
  personal data without an approved DPIA. It is not available to apps in a landing zone.
- Locally, `az login` gives `DefaultAzureCredential` your identity; your IP must be allowed on the
  Foundry account. Without settings the agent answers "not configured".

## Gateway (Premium service level)

Calls go through API Management with per-app and total token limits. Expect 429 and 403 as
normal answers. The token audience the gateway expects is still to be confirmed by itm8; use
`AI_TOKEN_SCOPE` (TypeScript) only when told.
