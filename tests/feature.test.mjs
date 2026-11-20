import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clarifications, features, newBug, newFeature, nextId, parseGates, planFeature, slugify, syncProfile, taskCounts } from '../scripts/feature.mjs';
import { runChecks } from '../scripts/build-check.mjs';
import { PLUGIN_ROOT, cleanup, edit, project, read, tempDir, write } from './helpers.mjs';

const DATE = '2026-10-29';
const GATES = readFileSync(join(PLUGIN_ROOT, 'templates', 'specs', 'gates.md'), 'utf8');
const answerAll = (t) => t.replace(/\[NEEDS CLARIFICATION:[^\]]*\]/g, 'answered');
const fillGates = (t) => t.replace(/\| \| \|$/gm, '| PASS | checked |');
const sign = (t) => t.replace('<name>, <YYYY-MM-DD>', 'A. Reviewer, 2026-10-30');
const af30 = (dir) => runChecks(dir, { today: DATE }).results.find((r) => r.id === 'AF-30');

/** A web project with one feature that is planned, gates filled and signed. */
function plannedProject() {
  const dir = project({ db: true });
  const { id } = newFeature(dir, { title: 'Export orders to CSV', date: DATE });
  edit(dir, `specs/${id}/spec.md`, answerAll);
  planFeature(dir, { ref: '1', date: DATE });
  edit(dir, `specs/${id}/plan.md`, (t) => sign(fillGates(t)));
  syncProfile(dir);
  return { dir, id };
}

describe('feature specs', () => {
  after(cleanup);

  it('makes short ASCII slugs', () => {
    assert.equal(slugify('Export orders to CSV for the finance team'), 'export-orders-to-csv-for');
    assert.equal(slugify('Sök på åäö!'), 'sok-pa-aao');
    assert.equal(slugify('!!!'), 'feature');
  });

  it('numbers after the highest number in use, without reusing gaps', () => {
    assert.equal(nextId([]), '001');
    assert.equal(nextId(['001-a', '003-b', 'bugs', 'README.md']), '004');
    assert.equal(nextId(['B001-x', '002-y'], 'B'), 'B002');
  });

  it('counts clarification markers outside comments and code only', () => {
    const text = '<!-- write [NEEDS CLARIFICATION: example] -->\nUse `[NEEDS CLARIFICATION]`.\n- FR-001 [NEEDS CLARIFICATION: which roles?]\n';
    assert.deepEqual(clarifications(text), ['which roles?']);
  });

  it('reads the gates table and the sign-off line', () => {
    assert.deepEqual(parseGates(GATES).problems, ['gates without a result: G1, G2, G3, G4, G5, G6, G7', 'gates not signed off by a person']);
    assert.deepEqual(parseGates(sign(fillGates(GATES))).problems, []);
    assert.equal(parseGates(sign(fillGates(GATES))).signedBy, 'A. Reviewer');
    const failNoNote = sign(fillGates(GATES)).replace(/(\| G3 [^\n]*)\| PASS \| checked \|/, '$1| ASK | |');
    assert.deepEqual(parseGates(failNoNote).problems, ['FAIL or ASK without a note: G3']);
    assert.match(parseGates(fillGates(GATES).replace('<name>, <YYYY-MM-DD>', 'Claude')).problems.join(), /not signed/);
    assert.deepEqual(parseGates('# Plan\n').problems, ['no AI Factory gates table', 'gates not signed off by a person']);
  });

  it('counts ticked and open tasks', () => {
    assert.deepEqual(taskCounts('- [x] T001 a\n- [ ] T002 b\n  - [X] T003 c\n- [ ] not a task\n'), { done: 2, open: 1 });
  });

  it('creates a spec with open questions and refuses to plan it', () => {
    const dir = project();
    const r = newFeature(dir, { title: 'Weekly summary', input: 'Send me a "weekly" summary', date: DATE });
    assert.equal(r.id, '001-weekly-summary');
    assert.equal(r.branch, 'feat/001-weekly-summary');
    const spec = read(dir, 'specs/001-weekly-summary/spec.md');
    assert.match(spec, /^# Feature specification: Weekly summary$/m);
    assert.match(spec, /Input: "Send me a  ?weekly  ?summary"/);
    assert.doesNotMatch(spec, /__[A-Z]+__/);
    const [f] = features(dir);
    assert.equal(f.status, 'specified');
    assert.equal(f.clarificationsOpen, 2);
    assert.throws(() => planFeature(dir, { ref: '001' }), (err) => err.open?.length === 2);
    assert.equal(af30(dir).status, 'PASS', 'open questions before planning are normal');
    assert.equal(newFeature(dir, { title: 'Second one', date: DATE }).id, '002-second-one');
  });

  it('plans with the build profile and the gates, and refuses to overwrite', () => {
    const { dir, id } = plannedProject();
    const plan = read(dir, `specs/${id}/plan.md`);
    assert.match(plan, /\*\*Storage\*\*: PostgreSQL/);
    assert.match(plan, /\| G6 Smallest change/);
    assert.match(read(dir, `specs/${id}/tasks.md`), /- \[ \] T008 Run the AI Factory build check/);
    assert.throws(() => planFeature(dir, { ref: id }), /exists already/);
    assert.equal(af30(dir).status, 'PASS', af30(dir).detail);
  });

  it('AF-30 warns about a question added after planning', () => {
    const { dir, id } = plannedProject();
    edit(dir, `specs/${id}/plan.md`, (t) => t.replace('## Design', '## Design\n\n[NEEDS CLARIFICATION: retention?]'));
    syncProfile(dir);
    assert.equal(af30(dir).status, 'WARN');
    assert.match(af30(dir).files.join(), /1 open clarification/);
  });

  it('derives the status from the tasks and keeps the profile in step', () => {
    const { dir, id } = plannedProject();
    edit(dir, `specs/${id}/tasks.md`, (t) => t.replace('- [ ] T001', '- [x] T001'));
    assert.equal(features(dir)[0].status, 'in-progress');
    assert.equal(af30(dir).status, 'WARN');
    assert.match(af30(dir).files.join(), /out of step/);
    assert.equal(syncProfile(dir, { check: true }).changed, true);
    syncProfile(dir);
    assert.equal(af30(dir).status, 'PASS');
    edit(dir, `specs/${id}/tasks.md`, (t) => t.replaceAll('- [ ] T', '- [x] T'));
    syncProfile(dir);
    const profile = JSON.parse(read(dir, '.aifactory/build-profile.json'));
    assert.deepEqual(profile.features, [
      { id, title: 'Export orders to CSV', spec: `specs/${id}/spec.md`, status: 'done', clarificationsOpen: 0, gatesSignedOff: true },
    ]);
  });

  it('accepts an older project without a features key until a spec appears', () => {
    const dir = project();
    edit(dir, '.aifactory/build-profile.json', (t) => {
      const p = JSON.parse(t);
      delete p.features;
      return JSON.stringify(p, null, 2);
    });
    assert.equal(af30(dir).status, 'PASS');
    assert.equal(syncProfile(dir, { check: true }).changed, false);
  });

  it('works in a folder without a build profile, except sync', () => {
    const dir = tempDir();
    const r = newFeature(dir, { title: 'Anything', date: DATE });
    assert.equal(r.id, '001-anything');
    assert.match(read(dir, 'specs/README.md'), /Spec Kit/);
    assert.throws(() => syncProfile(dir), /No \.aifactory\/build-profile\.json/);
  });

  it('numbers bug reports on their own', () => {
    const dir = project();
    assert.equal(newBug(dir, { title: 'Search ignores å', date: DATE }).id, 'B001-search-ignores-a');
    assert.equal(newBug(dir, { title: 'Second bug', date: DATE }).id, 'B002-second-bug');
    assert.match(read(dir, 'specs/bugs/B001-search-ignores-a/report.md'), /^- Verdict: open$/m);
    assert.deepEqual(features(dir), [], 'bugs are not features');
  });

  it('runs from the command line and exits 1 on a stale profile with --check', () => {
    const { dir, id } = plannedProject();
    const cli = (...args) => spawnSync(process.execPath, [join(PLUGIN_ROOT, 'scripts', 'feature.mjs'), ...args, '--dest', dir], { encoding: 'utf8' });
    assert.equal(cli('sync', '--check').status, 0);
    mkdirSync(join(dir, 'specs', '009-manual'));
    write(dir, 'specs/009-manual/spec.md', '# Feature specification: Manual\n');
    assert.equal(cli('sync', '--check').status, 1);
    assert.match(cli('list').stdout, /009-manual\s+specified/);
    assert.equal(cli('plan', '9').status, 0);
    assert.equal(cli('bogus').status, 1);
  });
});
