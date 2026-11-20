import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, tempDir } from './helpers.mjs';
import { callerWorkflow, installGate, parseArgs, withGateOwners } from '../scripts/install-gate.mjs';
import { DEPLOY_STEP } from '../lib/code-guard.mjs';

after(cleanup);

const git = (dir, ...args) =>
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], { encoding: 'utf8' });

function repo() {
  const dir = tempDir('aifc-gate-');
  git(dir, 'init', '-q', '-b', 'main');
  return dir;
}

// Built by concatenation so this file does not trip the secret guard itself.
const GH = 'gh' + 'p_' + 'a'.repeat(36);

describe('install-gate', () => {
  it('checks its arguments', () => {
    assert.throws(() => parseArgs([]), /zone/);
    assert.throws(() => parseArgs(['--zone', 'blue']), /zone/);
    assert.throws(() => parseArgs(['--zone', 'green', '--level', '4']), /level/);
    assert.throws(() => parseArgs(['--zone', 'green', '--owner', 'team']), /owner/);
    assert.throws(() => parseArgs(['--zone', 'green', '--test-command', 'a\nb']), /one line/);
    assert.equal(parseArgs(['--zone', 'red', '--level', '3']).level, 3);
  });

  it('fills the caller workflow; an empty test command stays empty', () => {
    const wf = callerWorkflow({ zone: 'yellow', level: 2, testCommand: 'npm ci && npm test', nodeVersion: '24' });
    assert.match(wf, /zone: yellow /);
    assert.match(wf, /level: 2 /);
    assert.match(wf, /test-command: "npm ci && npm test"/);
    assert.match(wf, /gate\.yml@v0/);
    assert.doesNotMatch(wf, /\{\{/);
    assert.match(callerWorkflow({ zone: 'green', level: 2, testCommand: '', nodeVersion: '24' }), /test-command: ""/);
    assert.ok(!DEPLOY_STEP.test(wf), 'the caller signs in to nothing itself, so build check AF-09 passes');
  });

  it('adds CODEOWNERS entries once and keeps existing lines', () => {
    const first = withGateOwners('* @acme/devs\n', '@itm8/aifactory-review');
    assert.match(first, /^\* @acme\/devs\n/);
    assert.match(first, /\/\.github\/workflows\/aifactory-gate\.yml @itm8\/aifactory-review/);
    assert.equal(withGateOwners(first, '@itm8/aifactory-review'), null);
  });

  it('writes the files, sets the hooks path, and refuses to overwrite the workflow', () => {
    const dir = repo();
    const written = installGate({ dir, zone: 'green', level: 2, testCommand: 'npm test', nodeVersion: '24', owner: '@me', force: false });
    assert.deepEqual(written, ['.github/workflows/aifactory-gate.yml', 'CODEOWNERS', '.aifactory/secrets.mjs', '.aifactory/secret-check.mjs', '.githooks/pre-commit']);
    assert.equal(git(dir, 'config', 'core.hooksPath').trim(), '.githooks');
    assert.throws(() => installGate({ dir, zone: 'green', level: 2, testCommand: '', nodeVersion: '24', owner: '@me', force: false }), /exists/);
    installGate({ dir, zone: 'red', level: 2, testCommand: '', nodeVersion: '24', owner: '@me', force: true });
    assert.match(readFileSync(join(dir, '.github/workflows/aifactory-gate.yml'), 'utf8'), /zone: red/);
  });

  it('uses .github/CODEOWNERS when the project already has one', () => {
    const dir = repo();
    mkdirSync(join(dir, '.github'));
    writeFileSync(join(dir, '.github', 'CODEOWNERS'), '* @acme/devs\n');
    const written = installGate({ dir, zone: 'green', level: 2, testCommand: '', nodeVersion: '24', owner: '@me', force: false });
    assert.ok(written.includes('.github/CODEOWNERS'));
    assert.ok(!existsSync(join(dir, 'CODEOWNERS')));
  });

  it('refuses a folder that is not a repository root', () => {
    assert.throws(() => installGate({ dir: tempDir(), zone: 'green', level: 2, testCommand: '', nodeVersion: '24', owner: '@me', force: false }), /not the root/);
  });

  it('the secret check stops a staged secret and a .env file, and lets a clean commit through', () => {
    const dir = repo();
    installGate({ dir, zone: 'green', level: 2, testCommand: '', nodeVersion: '24', owner: '@me', force: false });
    const check = () => spawnSync(process.execPath, ['.aifactory/secret-check.mjs'], { cwd: dir, encoding: 'utf8' });

    writeFileSync(join(dir, 'ok.ts'), 'export const a = 1;\n');
    git(dir, 'add', 'ok.ts');
    assert.equal(check().status, 0);

    writeFileSync(join(dir, 'config.ts'), `export const token = '${GH}';\n`);
    git(dir, 'add', 'config.ts');
    const hit = check();
    assert.equal(hit.status, 1);
    assert.match(hit.stderr, /config\.ts, line 1: looks like a GitHub token/);
    assert.ok(!hit.stderr.includes(GH), 'never prints the value');
    git(dir, 'rm', '-q', '--cached', 'config.ts');

    writeFileSync(join(dir, '.env'), 'A=1\n');
    git(dir, 'add', '-f', '.env');
    assert.match(check().stderr, /\.env: a \.env file/);
  });
});
