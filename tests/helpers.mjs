import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PLUGIN_ROOT, scaffold } from '../scripts/scaffold.mjs';

export { PLUGIN_ROOT };

const roots = [];
export function tempDir(prefix = 'aifc-') {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}
export function cleanup() {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/** A scaffolded project in a new temp folder. */
export function project(opts = {}) {
  const dest = join(tempDir(), 'app');
  scaffold({ dest, title: 'Test app', target: 'lz-online', date: '2026-10-29', ...opts });
  return dest;
}

/** A copy of a project folder, to mutate without touching the original. */
export function copyOf(dir) {
  const dest = join(tempDir(), 'copy');
  cpSync(dir, dest, { recursive: true });
  return dest;
}

export const read = (dir, rel) => readFileSync(join(dir, ...rel.split('/')), 'utf8');
export const write = (dir, rel, text) => writeFileSync(join(dir, ...rel.split('/')), text);
export const edit = (dir, rel, fn) => write(dir, rel, fn(read(dir, rel)));

/** Runs a guard hook (default: the secret guard) with a hook payload; returns the parsed decision or null. */
export function guard(payload, env = {}, script = 'secret-guard.mjs') {
  const res = spawnSync(process.execPath, [join(PLUGIN_ROOT, 'hooks', 'scripts', script)], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    // Off switches and the project folder never leak in from the shell that runs the tests.
    env: {
      ...process.env,
      AIFACTORY_SECRET_GUARD: '',
      AIFACTORY_CODE_GUARD: '',
      AIFACTORY_COMMAND_GUARD: '',
      AIFACTORY_PROTECTED_FILES_GUARD: '',
      CLAUDE_PROJECT_DIR: '',
      ...env,
    },
  });
  if (res.status !== 0) throw new Error(`guard exited ${res.status}: ${res.stderr}`);
  return res.stdout.trim() ? JSON.parse(res.stdout) : null;
}
