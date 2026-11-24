import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { PLUGIN_ROOT } from './helpers.mjs';

// Claude Code has a built-in /ship, so the plugin's command is /aifactory-code:submit. The old
// name stays as a one-line pointer (commands/ship.md) and is named nowhere else except the
// changelogs and the README note on the rename.
const OLD = 'aifactory-code:ship';
const NEW = 'aifactory-code:submit';

const text = (rel) => readFileSync(join(PLUGIN_ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('submit command (was ship)', () => {
  it('submit is the working command and still never merges or deploys', () => {
    const body = text('commands/submit.md');
    assert.match(body, /gh pr create/);
    assert.match(body, /build-check\.mjs/);
    assert.match(body, /Never merge, approve, deploy/);
  });

  it('ship is only a pointer to submit: it runs nothing', () => {
    const body = text('commands/ship.md');
    assert.ok(body.includes(NEW), 'names the new command');
    assert.ok(body.split('\n').length < 12, 'stays short');
    assert.doesNotMatch(body, /git push|git commit|gh pr|build-check/);
  });

  it('the docs that send people to open a pull request name submit', () => {
    for (const rel of ['commands/gate.md', 'skills/aifactory-code/SKILL.md', 'README.md']) {
      assert.ok(text(rel).includes(NEW), `${rel} names ${NEW}`);
    }
  });

  it('nothing else names the old command', () => {
    const roots = ['commands', 'skills', 'templates', 'presets', 'scripts', 'hooks', 'lib'];
    const files = [...roots.flatMap((dir) => walk(join(PLUGIN_ROOT, dir))), join(PLUGIN_ROOT, 'AGENTS.md')];
    const stale = files
      .map((file) => relative(PLUGIN_ROOT, file).split(sep).join('/'))
      .filter((rel) => rel !== 'commands/ship.md' && readFileSync(join(PLUGIN_ROOT, ...rel.split('/')), 'utf8').includes(OLD));
    assert.deepEqual(stale, []);
  });
});
