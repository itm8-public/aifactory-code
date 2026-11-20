// Stops a commit that adds a secret or a .env file. Installed by the aifactory-code plugin and run by
// .githooks/pre-commit, so it works with any tool that commits (Claude Code, Cursor, Lovable's sync,
// a terminal). Plain Node, no dependencies. Never prints a secret value.
import { execFileSync } from 'node:child_process';
import { findSecret, isAgentsToolkitEnv, isDotEnvFile } from './secrets.mjs';

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
const problems = [];
for (const file of staged) {
  if (isDotEnvFile(file) && !isAgentsToolkitEnv(file)) {
    problems.push(`${file}: a .env file. Keep settings as names in .env.example; values belong in the platform or Key Vault.`);
    continue;
  }
  let text;
  try {
    text = git(['show', `:${file}`]);
  } catch {
    continue;
  }
  if (text.includes('\0')) continue; // binary
  const hit = findSecret(text);
  if (hit) problems.push(`${file}, line ${hit.line}: looks like a ${hit.rule}.`);
}

if (problems.length) {
  console.error('Commit stopped: this change contains something that looks like a secret.\n');
  for (const p of problems) console.error(`- ${p}`);
  console.error('\nRemove it (and rotate it if it was real), then commit again. Ask itm8 if this is a false alarm.');
  process.exit(1);
}
