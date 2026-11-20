# Release a Copilot agent

All steps are done by a person. Claude prepares the package and the hand-over notes; it never runs
`atk provision` or `atk publish`, and CI only validates.

1. **Before**: `npm run copilot:check` or `node scripts/sync-tools.mjs --check`, the build check,
   and CI (Agents Toolkit validation) pass. The MCP server is deployed to the environment that
   `MCP_URL` names, and SSO is set up ([sso.md](sso.md)).
2. **Develop**: `atk provision --env dev` registers the app, validates and sideloads it for you.
   In Copilot, select the agent and run `eval/questions.md` with `-developer on`, as a normal user
   and as a user with fewer rights. Record the results.
3. **Publish**: `atk publish --env prod` submits the package to the organisation's catalogue.
4. **Approve**: a Microsoft 365 admin reviews the request (admin center > Agents > Requests),
   approves it and assigns it to a pilot group, later to everyone. For a customer tenant, the
   customer's admin does this.
5. **Kill switch**: remove the assignment or block the agent in the admin center. Revoking the
   app role or Easy Auth audience stops the MCP calls too.
6. **Changes**: any change to the package, including a new tool, is a new version: bump `version`
   in `appPackage/manifest.json`, publish, and the admin approves again.
