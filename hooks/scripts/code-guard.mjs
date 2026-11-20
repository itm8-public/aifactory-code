#!/usr/bin/env node
// PreToolUse guard for Write, Edit and MultiEdit. Active only inside an AI Factory project: a
// folder above the file holds .aifactory/build-profile.json (built with this plugin) or
// .aifactory/replatform-plan.json (being replatformed). It denies, in the new text only:
//  1. infrastructure files (Bicep, Terraform, azure.yaml) and deploy steps in workflows (AF-09);
//  2. direct calls to AI providers other than Azure AI Foundry (AF-19);
//  3. unsafe code shapes outside tests: TLS checks off, text run as code, shell or SQL built from
//     strings, raw HTML, CORS open to every site (AF-31).
// Guidance, not a security boundary: the build check and CI are the gate, and the change gate in
// GUARD.md does the thinking. Malformed input fails open. AIFACTORY_CODE_GUARD=off turns it off
// for a session.
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { DEPLOY_STEP, DIRECT_AI, INFRA_FILE, findUnsafeCode } from '../../lib/code-guard.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|py)$/;

const denial = (reason) =>
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[aifactory-code code guard] ${reason} Fix the cause; never work around the guard. If you are sure it is wrong, say so to the person.`,
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

/** The AI Factory project folder that holds the file, or null. */
export function projectRoot(file) {
  let dir = dirname(file);
  for (;;) {
    if (existsSync(join(dir, '.aifactory', 'build-profile.json')) || existsSync(join(dir, '.aifactory', 'replatform-plan.json'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** Returns the denial JSON, or null to allow. */
export function decide(input) {
  if (!['Write', 'Edit', 'MultiEdit'].includes(input?.tool_name)) return null;
  const raw = String(input.tool_input?.file_path ?? '');
  if (!raw) return null;
  const file = isAbsolute(raw) ? raw : resolve(input.cwd ?? process.cwd(), raw);
  const root = projectRoot(file);
  if (!root) return null;
  const rel = relative(root, file).replace(/\\/g, '/');

  if (INFRA_FILE.test(rel)) {
    return denial(`Blocked: ${rel} is infrastructure code (AF-09). itm8's Wizard generates the landing zone, infrastructure and pipelines; the app repository holds none.`);
  }
  for (const text of contentOf(input)) {
    const lines = text.split('\n');
    if (/^\.github\/workflows\/[^/]+\.ya?ml$/.test(rel)) {
      const i = lines.findIndex((l) => DEPLOY_STEP.test(l));
      if (i >= 0) return denial(`Blocked: a deploy step in ${rel} (line ${i + 1} of the new text, AF-09). A workflow here only builds, tests and scans; the Wizard's pipelines deploy.`);
    }
    if (CODE.test(rel) || /(^|\/)\.env\.example$/.test(rel)) {
      const i = lines.findIndex((l) => DIRECT_AI.test(l));
      if (i >= 0) return denial(`Blocked: a direct AI provider in ${rel} (line ${i + 1} of the new text, AF-19). Call Azure AI Foundry with the managed identity, through the one AI module.`);
    }
    const hit = findUnsafeCode(rel, text);
    if (hit) return denial(`Blocked: ${hit.what} in ${rel} (line ${hit.line} of the new text, AF-31 ${hit.id}). ${hit.fix}`);
  }
  return null;
}

async function main() {
  if ((process.env.AIFACTORY_CODE_GUARD ?? '').toLowerCase() === 'off') return;
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
