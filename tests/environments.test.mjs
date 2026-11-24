import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ROOT } from './helpers.mjs';

// A change reaches dev only through a pull request, the gate and the pipeline; production only
// through the pipeline with an approval; experiments go in the sandbox. The reference says it,
// and the places people and Claude read first point to it.
const text = (rel) => readFileSync(join(PLUGIN_ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');
const REF = 'skills/aifactory-code/reference/environments.md';

describe('environments: sandbox, dev and production', () => {
  it('the reference names the three places and the one way into each', () => {
    const body = text(REF);
    assert.match(body, /\*\*Sandbox\*\*/);
    assert.match(body, /\*\*Dev\*\*/);
    assert.match(body, /\*\*Production\*\*/);
    assert.match(body, /gate \/ verdict/);
    assert.match(body, /deploys dev on every push to `main`/);
    assert.match(body, /approval from a person/);
    assert.match(body, /Read-only/);
    assert.match(body, /Try it in your dev environment after the check passes/);
  });

  it('the reference never suggests ARM MCP against dev or production', () => {
    const body = text(REF);
    assert.match(body, /ARM MCP is never used against dev/);
    assert.match(body, /never suggest ARM MCP against production/);
    assert.match(body, /\| You may use them directly/);
  });

  it('the skill, submit, the README and the hosting page point to it', () => {
    for (const rel of [
      'skills/aifactory-code/SKILL.md',
      'commands/submit.md',
      'README.md',
      'skills/aifactory-code/reference/hosting-customer-lz.md',
    ]) {
      assert.ok(text(rel).includes('environments.md'), `${rel} links environments.md`);
    }
  });

  it('submit tells a non-developer where the change shows up, and still deploys nothing', () => {
    const body = text('commands/submit.md');
    assert.match(body, /Try it in your\s+dev environment after the check passes/);
    assert.match(body, /Never merge, approve, deploy/);
  });

  it('nothing says the app team may deploy by hand, or that the plugin never deploys anywhere at all', () => {
    for (const rel of ['skills/aifactory-code/reference/hosting-customer-lz.md', 'skills/aifactory-code/SKILL.md', 'README.md']) {
      assert.doesNotMatch(text(rel), /beyond the lowest environment/, rel);
    }
    assert.doesNotMatch(text('skills/aifactory-code/SKILL.md'), /You never deploy\.\n/);
  });
});
