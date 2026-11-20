import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cleanup, guard, project, tempDir } from './helpers.mjs';
import { protectedKind } from '../lib/protected-files.mjs';

const filesGuard = (payload, env) => guard(payload, env, 'protected-files-guard.mjs');
const write = (file_path, content = 'x\n') => ({ tool_name: 'Write', tool_input: { file_path, content } });
const verdict = (out) => out?.hookSpecificOutput?.permissionDecision ?? null;
const reason = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? '';

// Protected paths and what the guard calls them.
const PROTECTED = [
  ['.github/workflows/ci.yml', 'a CI workflow'],
  ['azure-pipelines.yml', 'a pipeline definition'],
  ['build/azure-pipelines-release.yaml', 'a pipeline definition'],
  ['.gitlab-ci.yml', 'a pipeline definition'],
  ['bitbucket-pipelines.yml', 'a pipeline definition'],
  ['infra/modules/network.json', 'infrastructure code'],
  ['deploy/main.bicep', 'infrastructure code'],
  ['deploy/main.bicepparam', 'infrastructure code'],
  ['terraform/main.tf', 'infrastructure code'],
  ['Dockerfile', 'a container build file'],
  ['apps/api/Dockerfile.dev', 'a container build file'],
  ['CODEOWNERS', 'a code owners or branch protection file'],
  ['.github/CODEOWNERS', 'a code owners or branch protection file'],
  ['.github/settings.yml', 'a code owners or branch protection file'],
  ['.github/rulesets/main.json', 'a code owners or branch protection file'],
  ['ops/branch-protection.json', 'a code owners or branch protection file'],
];
const ORDINARY = ['src/server/app.ts', 'README.md', 'package.json', 'src/infrastructure.ts', 'docs/dockerfile-notes.md', '.github/dependabot.yml', 'src/web/Infra.tsx'];

/** A git repository with the given files added (no commit is needed for git to track them). */
function repo(files, root = tempDir()) {
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  mkdirSync(root, { recursive: true });
  git('init');
  for (const f of files) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), 'x\n');
  }
  git('add', '-A');
  return root;
}

describe('protected files guard', () => {
  let root;
  before(() => {
    root = repo([...PROTECTED.map(([f]) => f), ...ORDINARY]);
  });
  after(cleanup);

  it('knows the protected kinds and leaves ordinary files alone', () => {
    for (const [file, what] of PROTECTED) assert.equal(protectedKind(file), what, file);
    for (const file of ORDINARY) assert.equal(protectedKind(file), null, file);
    assert.equal(protectedKind('C:\\repo\\.github\\workflows\\ci.yml'), 'a CI workflow');
  });

  for (const [file, what] of PROTECTED) {
    it(`asks before changing a tracked ${file}`, () => {
      const out = filesGuard(write(join(root, file)));
      assert.equal(verdict(out), 'ask');
      assert.ok(reason(out).includes(`protected files guard] ${file} is ${what} that is already in the repository.`), reason(out));
      assert.ok(!reason(out).includes('\n'));
    });
  }

  it('stays silent for tracked ordinary files', () => {
    for (const file of ORDINARY) assert.equal(filesGuard(write(join(root, file))), null, file);
  });

  it('checks Edit and MultiEdit, and relative paths from the hook cwd', () => {
    const file = join(root, 'Dockerfile');
    assert.equal(verdict(filesGuard({ tool_name: 'Edit', tool_input: { file_path: file, old_string: 'x', new_string: 'y' } })), 'ask');
    assert.equal(verdict(filesGuard({ tool_name: 'MultiEdit', tool_input: { file_path: file, edits: [{ old_string: 'x', new_string: 'y' }] } })), 'ask');
    assert.equal(verdict(filesGuard({ ...write('.github/workflows/ci.yml'), cwd: root })), 'ask');
  });

  it('does not ask about a new file, or one git does not track yet', () => {
    assert.equal(filesGuard(write(join(root, '.github/workflows/release.yml'))), null);
    assert.equal(filesGuard(write(join(root, 'services/worker/Dockerfile'))), null);
    writeFileSync(join(root, 'Dockerfile.local'), 'FROM scratch\n');
    assert.equal(filesGuard(write(join(root, 'Dockerfile.local'))), null);
  });

  it('does not block a brand-new scaffolded project, before or after git init', () => {
    const app = project({ db: true });
    const files = ['Dockerfile', '.github/workflows/ci.yml', '.github/dependabot.yml'];
    for (const f of files) assert.equal(filesGuard(write(join(app, f))), null, f);
    execFileSync('git', ['init'], { cwd: app, stdio: 'ignore' });
    for (const f of files) assert.equal(filesGuard(write(join(app, f))), null, `${f} after git init`);
    // Once the person has added the files to git, the guard asks.
    execFileSync('git', ['add', '-A'], { cwd: app, stdio: 'ignore' });
    assert.equal(verdict(filesGuard(write(join(app, 'Dockerfile')))), 'ask');
    assert.equal(filesGuard(write(join(app, 'src/server/app.ts'))), null);
  });

  it('matches the path inside the repository, not the folders above it', () => {
    const nested = repo(['src/app.ts', 'Dockerfile'], join(tempDir(), 'infra', 'app'));
    assert.equal(filesGuard(write(join(nested, 'src/app.ts'))), null);
    assert.equal(verdict(filesGuard(write(join(nested, 'Dockerfile')))), 'ask');
  });

  it('ignores other tools, fails open on bad input and turns off with AIFACTORY_PROTECTED_FILES_GUARD=off', () => {
    assert.equal(filesGuard({ tool_name: 'Read', tool_input: { file_path: join(root, 'Dockerfile') } }), null);
    assert.equal(filesGuard({ tool_name: 'Write', tool_input: {} }), null);
    assert.equal(filesGuard('not json'), null);
    assert.equal(filesGuard(write(join(root, 'Dockerfile')), { AIFACTORY_PROTECTED_FILES_GUARD: 'off' }), null);
  });
});
