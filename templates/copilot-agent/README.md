# __TITLE__ in Microsoft 365 Copilot

A declarative agent for Microsoft 365 Copilot (Microsoft 365 Agents Toolkit project). It calls the
MCP server at `MCP_URL` with the signed-in user's Entra token (SSO), so it sees exactly what that
user may see in the app. Read-only. Made with the `aifactory-code` plugin (__PLUGIN_VERSION__).

| File | What |
|---|---|
| `appPackage/declarativeAgent.json` | Name, instructions, disclaimer, conversation starters |
| `appPackage/instructions.txt` | How the agent answers (at most 8,000 characters) |
| `appPackage/ai-plugin.json` | The MCP runtime: URL, Entra SSO, the pinned tools |
| `appPackage/mcp-tools.json` | The pinned tool list (the server's `tools/list`) |
| `env/.env.dev`, `env/.env.prod` | Non-secret settings; the SSO id goes in `env/.env.<env>.user` (gitignored) |
| `eval/questions.md` | Questions to run in Copilot before each release |

## The tool list is pinned

Copilot calls only the tools listed in the package. A new or changed tool reaches users only
through a release and the Microsoft 365 admin's approval.
<!-- @if addon -->
After you change the MCP tools in `src/server/lib/mcp-tools.ts`, run `npm run copilot:tools` in
the project root; `npm run copilot:check` (and CI, and the build check) fails while the package
and the server differ.
<!-- @endif -->
<!-- @if standalone -->
Export the server's tool list (for example with the MCP Inspector: connect to `MCP_URL`, run
`tools/list`, save the `result` object) to `appPackage/mcp-tools.json`, then run
`node scripts/sync-tools.mjs`. `node scripts/sync-tools.mjs --check` (and CI) fails while the
package and the list differ.
<!-- @endif -->

## Set up sign-in (once per environment, by a person)

1. **Entra app registration of the MCP server's app** (the one Easy Auth uses): under Expose an
   API, a scope such as `access_as_user`; under Expose an API, pre-authorise the Microsoft Enterprise
   token store `ab3be6b7-f5df-413d-ac2d-abf1e3fd9c0b` for it; under Authentication (Web), add the
   redirect URI `https://teams.microsoft.com/api/platform/v1.0/oAuthConsentRedirect`.
2. **Teams developer portal** > Tools > Microsoft Entra SSO client ID registration: base URL = the
   origin of `MCP_URL`, restrict to your organisation, client id = the app registration above,
   scope = the scope above. Save the **registration ID** as `MCP_SSO_REFERENCE_ID` in
   `env/.env.<env>.user`, and add the **Application ID URI** it shows to the app registration's
   `identifierUris` (manifest editor).
3. **Easy Auth on the app**: its allowed audiences must include that Application ID URI, so the
   tokens Copilot sends are accepted. Give this to whoever runs the Wizard or the platform.
4. The app accepts tokens from the token store on `/mcp` only and refuses them on every other route.

## Release (by a person)

```bash
atk provision --env dev   # sideloads the agent for you; run eval/questions.md with -developer on
atk publish --env prod    # submits to the organisation's catalogue
```

A Microsoft 365 admin approves the request (admin center > Agents > Requests) and assigns the
agent to a pilot group, later to everyone. Removing the assignment is the kill switch.

Manifest versions: app manifest 1.22, declarative agent 1.9, plugin 2.4 (the combination itm8 runs
in production). Newer app manifest versions exist; move up deliberately and re-test.
