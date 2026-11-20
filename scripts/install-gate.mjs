#!/usr/bin/env node
// Installs the itm8 AI Factory gate files in a project. Writes files only; the person commits them
// in a pull request, and itm8 sets up the ruleset and environments (aifactory-gate setup script).
//
//   node install-gate.mjs [--dir .] --zone green|yellow|red [--level 2] [--test-command "npm ci && npm test"]
//                         [--node-version 24] [--owner @org/aifactory-review] [--force]
//
// Writes:
//   .github/workflows/aifactory-gate.yml   calls the gate's reusable workflow
//   CODEOWNERS entries                     the gate files need the itm8 review team
//   .aifactory/secret-check.mjs + secrets.mjs, .githooks/pre-commit   stops secrets before a commit
// and points this clone's git hooks at .githooks.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGIN_ROOT } from './scaffold.mjs';

const GATE_FILES = ['/.github/workflows/aifactory-gate.yml', '/.github/CODEOWNERS', '/CODEOWNERS', '/.aifactory/', '/.githooks/'];

export function parseArgs(argv) {
  const opts = { dir: '.', level: 2, testCommand: '', nodeVersion: '24', owner: '@OWNER/aifactory-review', force: false };
  const keys = { '--dir': 'dir', '--zone': 'zone', '--level': 'level', '--test-command': 'testCommand', '--node-version': 'nodeVersion', '--owner': 'owner' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') opts.force = true;
    else if (keys[argv[i]] && argv[i + 1] !== undefined) opts[keys[argv[i]]] = argv[++i];
    else throw new Error(`unknown or incomplete option "${argv[i]}"`);
  }
  if (!['green', 'yellow', 'red'].includes(opts.zone)) throw new Error('--zone must be green, yellow or red');
  opts.level = Number(opts.level);
  if (![1, 2, 3].includes(opts.level)) throw new Error('--level must be 1, 2 or 3');
  if (!/^@[\w.-]+(\/[\w.-]+)?$/.test(opts.owner)) throw new Error('--owner must be @user or @org/team');
  if (!/^\d+(\.\d+){0,2}$/.test(opts.nodeVersion)) throw new Error('--node-version must be a version number');
  if (/[\r\n]/.test(opts.testCommand)) throw new Error('--test-command must be one line');
  return opts;
}

/** The caller workflow with the values filled in. An empty test command means "no tests configured". */
export function callerWorkflow({ zone, level, testCommand, nodeVersion }) {
  const template = readFileSync(join(PLUGIN_ROOT, 'lib', 'gate', 'aifactory-gate.yml'), 'utf8');
  return template
    .replace('{{ZONE}}', zone)
    .replace('{{LEVEL}}', String(level))
    .replace('{{NODE_VERSION}}', nodeVersion)
    .replace('{{TEST_COMMAND}}', JSON.stringify(testCommand));
}

/** CODEOWNERS with the gate entries added once; existing lines are kept. */
export function withGateOwners(existing, owner) {
  const lines = existing ? existing.replace(/\r\n/g, '\n').replace(/\n*$/, '').split('\n') : [];
  const missing = GATE_FILES.filter((p) => !lines.some((l) => l.split(/\s+/)[0] === p));
  if (missing.length === 0) return null;
  const block = ['', '# itm8 AI Factory gate: changes to the gate need the itm8 review team.', ...missing.map((p) => `${p} ${owner}`)];
  return `${[...lines, ...block].join('\n').replace(/^\n/, '')}\n`;
}

const PRE_COMMIT = '#!/bin/sh\n# itm8 AI Factory: stop a commit that adds a secret or a .env file.\nexec node .aifactory/secret-check.mjs\n';

export function installGate(opts) {
  const dir = resolve(opts.dir);
  if (!existsSync(join(dir, '.git'))) throw new Error(`${dir} is not the root of a git repository`);
  const written = [];
  const write = (rel, content, { overwrite = true, mode } = {}) => {
    const full = join(dir, rel);
    if (existsSync(full) && !overwrite) throw new Error(`${rel} exists; use --force to replace it`);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
    if (mode) chmodSync(full, mode);
    written.push(rel);
  };

  write('.github/workflows/aifactory-gate.yml', callerWorkflow(opts), { overwrite: opts.force });
  const ownersPath = existsSync(join(dir, '.github', 'CODEOWNERS')) ? '.github/CODEOWNERS' : 'CODEOWNERS';
  const owners = withGateOwners(existsSync(join(dir, ownersPath)) ? readFileSync(join(dir, ownersPath), 'utf8') : '', opts.owner);
  if (owners) write(ownersPath, owners);
  write('.aifactory/secrets.mjs', readFileSync(join(PLUGIN_ROOT, 'lib', 'secrets.mjs'), 'utf8'));
  write('.aifactory/secret-check.mjs', readFileSync(join(PLUGIN_ROOT, 'lib', 'gate', 'secret-check.mjs'), 'utf8'));
  write('.githooks/pre-commit', PRE_COMMIT, { mode: 0o755 });
  execFileSync('git', ['-C', dir, 'config', 'core.hooksPath', '.githooks']);
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    for (const f of installGate(opts)) console.log(`wrote ${f}`);
    console.log('\nGit hooks for this clone now run .githooks (each clone runs: git config core.hooksPath .githooks).');
    console.log('Next: commit these files in a pull request. itm8 then turns on the ruleset and the dev and prod environments.');
  } catch (err) {
    console.error(`install-gate: ${err.message}`);
    process.exitCode = 1;
  }
}
