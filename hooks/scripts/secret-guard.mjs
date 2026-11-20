#!/usr/bin/env node
// PreToolUse guard for Write, Edit and MultiEdit:
//  1. Writing a .env file (not .env.example) is denied: values stay with the person, never Claude.
//  2. Content with a secret-shaped value (private key, token, password in a connection string,
//     account key) is denied, wherever it would be written.
// Guidance, not a security boundary. Malformed input fails open. AIFACTORY_SECRET_GUARD=off
// turns it off for a session. The matched value is never echoed.
import { findSecret, isAgentsToolkitEnv, isDotEnvFile } from '../../lib/secrets.mjs';

const denial = (reason) =>
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[aifactory-code secret guard] ${reason}`,
    },
  });

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

function contentOf(input) {
  const t = input.tool_input ?? {};
  if (typeof t.content === 'string') return [t.content];
  if (typeof t.new_string === 'string') return [t.new_string];
  if (Array.isArray(t.edits)) return t.edits.map((e) => e?.new_string).filter((s) => typeof s === 'string');
  return [];
}

/** Returns the denial JSON, or null to allow. */
export function decide(input) {
  if (!['Write', 'Edit', 'MultiEdit'].includes(input?.tool_name)) return null;
  const file = String(input.tool_input?.file_path ?? '');
  if (isDotEnvFile(file) && !isAgentsToolkitEnv(file)) {
    return denial(
      `Writing ${file.split(/[\\/]/).pop()} is blocked: it holds real setting values. Ask the person to create it ` +
        'themselves (for example `cp .env.example .env`) and fill in the values. Put setting names in .env.example.',
    );
  }
  for (const text of contentOf(input)) {
    const hit = findSecret(text);
    if (hit) {
      return denial(
        `Blocked: the new text looks like it contains a ${hit.rule} (line ${hit.line}). Never put secret values in ` +
          'code or files. Read the setting from an environment variable, list its name in .env.example, and use ' +
          'the managed identity for Azure services. Use a placeholder such as <value> in examples.',
      );
    }
  }
  return null;
}

async function main() {
  if ((process.env.AIFACTORY_SECRET_GUARD ?? '').toLowerCase() === 'off') return;
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return; // fail open on malformed input
  }
  const out = decide(input);
  if (out) process.stdout.write(out);
}

main().catch(() => {
  // fail open
});
