# Where a change goes: sandbox, dev and production

A solution has three places. Each one has its own way in. Work out which place a request is about
before you touch anything, and never use one place's way into another.

| Place | What it is for | How a change gets there | Azure MCP and ARM MCP |
|---|---|---|---|
| **Sandbox** | Experiments, replatforming, trying a risky idea. The one-click sandbox from the Management App | Directly, freely | You may use them directly, to read and to change |
| **Dev** | The steady environment the team works against and tries changes in before production | Only through a pull request, the check `gate / verdict` and the pipeline. The pipeline deploys dev on every push to `main` | Read-only, to diagnose (logs, state, health). Never a change. ARM MCP is never used against dev |
| **Production** | The live solution | Only through the pipeline, with an approval from a person | Not used from here. Ask itm8 for what you need to see |

## Rules for you

1. **Know the place.** It is the sandbox only when the person says so and it is the sandbox the
   Management App created for them. When you cannot tell, treat it as dev: look, change nothing.
2. **Sandbox: try freely.** Azure MCP and ARM MCP are fine there. What you learn comes back as a
   pull request on the app, not as a copy of the sandbox. Needing new or changed Azure resources
   is an "ask itm8" item ([stop-and-ask.md](stop-and-ask.md)): the Wizard generates them.
3. **Dev: one way in.** Branch, pull request, the check, the pipeline. Do not deploy by hand, do not
   change dev resources with `az`, Azure MCP or ARM MCP, and never suggest ARM MCP against dev.
   Reading dev through a read-only MCP tool is fine when you are finding out why something fails.
4. **Production: you never deploy.** Not by starting a production run of the pipeline, not with
   `az`, not with an MCP tool, not as "just a small fix". Production runs through the pipeline with an approval from
   a person; you never give or ask for that approval, and never suggest ARM MCP against production.
5. **Someone asks you to deploy.** Say you do not deploy to dev or production. For dev, offer the
   pull request ([`/aifactory-code:submit`](../../../commands/submit.md)); once the check passes and
   the change is merged, the pipeline puts it in dev. For an experiment, offer the sandbox.

## Say it in plain words

The person may not be a developer. Leave out words like pipeline, resource group, revision or
ARM, and say what happens to them:

- "Try it in your dev environment after the check passes." (After the merge, dev gets it by itself.)
- "Try it in your sandbox first." (An experiment that does not go through review.)
- "I can't put it live. Production goes live through itm8's pipeline, after a person approves it."
