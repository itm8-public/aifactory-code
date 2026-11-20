# Sign-in and roles with Easy Auth

- In Azure, Easy Auth (Container Apps authentication) signs every user in with Microsoft Entra ID
  before a request reaches the app, and redirects to sign-in when there is no session. External
  users sign in as guests in the customer's tenant. There are no public pages.
- The app reads the user from the `X-MS-CLIENT-PRINCIPAL` header (base64 JSON with `claims`):
  `auth.ts` turns it into `req.user = { id, name, roles }`. `id` is the Entra **object id**; use
  it as the user key everywhere (audit rows, ownership), never the e-mail or name.
- The header is trustworthy only because the app is reachable through Easy Auth alone. Never add
  a route that lets a caller set it, and never forward it to another service.

## Roles

- Define Entra **app roles** on the app registration (for example `App.Reader`, `App.Editor`,
  `App.Admin`) and assign them to groups. They arrive as `roles` claims.
- Check on the server for every action: `requireRole(req, 'App.Admin')`. Hiding a button in the
  UI is a convenience, not a check.
- List the roles and what each may do in the README; the delivery lead creates them.

## Locally

- `.env` has `DEV_AUTH_BYPASS=true`: every API request acts as "Local developer" with the roles in
  `DEV_AUTH_ROLES`. Change the roles there to test permissions.
- The app refuses to start with the bypass when `APP_ENVIRONMENT` is set (Azure). Keep that check.
- Tests send a real-shaped principal header (`asUser(id, roles)` in `src/server/test/helpers.ts`).

## Sign-out and expiry

- Sign out with a link to `/.auth/logout`.
- When the session expires, Easy Auth answers API calls with 401 (the front end sends
  `X-Requested-With`), and `api()` reloads the page, which signs the user in again.
