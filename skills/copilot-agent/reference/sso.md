# Entra SSO for the MCP server

Copilot gets a token for the MCP server's app registration through the Microsoft Enterprise token
store and sends it on every call. Easy Auth on the app validates it and passes the user to the app
in `X-MS-CLIENT-PRINCIPAL`. Set-up, once per environment, by a person with rights on the app
registration (never Claude):

1. **App registration** of the app that serves `/mcp` (the one Easy Auth uses):
   - Expose an API: a scope, for example `access_as_user`.
   - Expose an API > Authorized client applications: add `ab3be6b7-f5df-413d-ac2d-abf1e3fd9c0b`
     (Microsoft Enterprise token store) for that scope.
   - Authentication > Web redirect URI: `https://teams.microsoft.com/api/platform/v1.0/oAuthConsentRedirect`.
   - App roles as the app needs them; assign users or groups (assignment required).
2. **Teams developer portal** > Tools > Microsoft Entra SSO client ID registration:
   - Base URL: the origin of `MCP_URL`. Restrict usage to your organisation; restrict by app once
     the agent has a published app id.
   - Client ID: the app registration above. Scope: the scope above.
   - Save. Copy the **registration ID** to `env/.env.<env>.user` as `MCP_SSO_REFERENCE_ID` (the
     person does this; the secret guard stops Claude), and add the **Application ID URI** it shows
     to the app registration's `identifierUris` (manifest editor; the UI shows only the first).
3. **Easy Auth** on the app: allowed audiences include that Application ID URI (and the API's own
   audience). For a customer landing zone this is a Wizard value; on itm8's shared platform, the
   platform team sets it.
4. **The app**: tokens from the token store are accepted on `/mcp` only (`COPILOT_TOKEN_STORE` in
   `src/server/auth.ts`); roles come from the token's `roles` claim as for any user.

The registration ID is not a credential, but it encodes the tenant id, so it stays out of the
repository.
