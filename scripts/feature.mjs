#!/usr/bin/env node
// Feature specs for an AI Factory project: specs/NNN-slug/{spec,plan,tasks}.md, bug reports in
// specs/bugs/BNNN-slug/report.md, and the `features` list in the build profile derived from them.
// The parsers are shared with build-check rule AF-30. No dependencies. Usage: see --help.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLUGIN_ROOT } from './scaffold.mjs';

const TEMPLATES = join(PLUGIN_ROOT, 'templates', 'specs');
const PROFILE = '.aifactory/build-profile.json';
const FEATURE_FILE = /^specs\/(\d{3}-[a-z0-9-]+)\/(spec|plan|tasks)\.md$/;
const MARKER = /\[NEEDS CLARIFICATION(?::\s*([^\]]*))?\]/g;
export const GATES = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
const RESULTS = ['PASS', 'FAIL', 'N/A', 'ASK'];

const HELP = `Usage: node scripts/feature.mjs <command> [options]

  new --title "<title>" [--input "<the request>"]   Create specs/NNN-slug/spec.md
  plan [<number>]                                   Create plan.md (with the AI Factory gates) and tasks.md;
                                                    refuses while the spec has open clarifications
  bug --title "<title>"                             Create specs/bugs/BNNN-slug/report.md
  list                                              Show each feature's status, clarifications and gates
  sync [--check]                                    Update "features" in ${PROFILE}; --check exits 1 when stale

  --dest <folder>   The project (default: the current folder)
  --date <date>     YYYY-MM-DD (default: today)
  --json            Print the result as JSON`;

/** Lower-case, ASCII, at most five words and 40 characters. */
export function slugify(title) {
  const words = title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) ?? [];
  return words.slice(0, 5).join('-').slice(0, 40).replace(/-+$/, '') || 'feature';
}

/** The next number after the highest one in use (gaps are not reused), as `NNN` or `BNNN`. */
export function nextId(names, prefix = '') {
  const re = new RegExp(`^${prefix}(\\d{3})-`);
  const used = names.map((n) => re.exec(n)).filter(Boolean).map((m) => Number(m[1]));
  const next = Math.max(0, ...used) + 1;
  if (next > 999) throw new Error('No feature numbers left (999)');
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/** Text without HTML comments and inline code, where instructions mention markers as examples. */
const noComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '');
const prose = (text) => noComments(text).replace(/`[^`\n]*`/g, '');

/** The open [NEEDS CLARIFICATION: …] questions in a spec or plan. */
export function clarifications(text) {
  return [...prose(text ?? '').matchAll(MARKER)].map((m) => (m[1] ?? '').trim() || '(no question)');
}

/** The AI Factory gates table and sign-off line in a plan, and what is missing from them. */
export function parseGates(text) {
  const body = noComments(text ?? '');
  const rows = {};
  for (const line of body.split('\n')) {
    const m = /^\|\s*(G[1-7])\b[^|]*\|[^|]*\|([^|]*)\|([^|]*)\|/.exec(line);
    if (m && !rows[m[1]]) rows[m[1]] = { result: m[2].trim().toUpperCase(), note: m[3].trim() };
  }
  const line = /^Gates signed off by:[ \t]*(.*)$/m.exec(body)?.[1].trim() ?? '';
  const sign = /^([^<>]*\S)\s*,\s*(\d{4}-\d{2}-\d{2})$/.exec(line);
  const problems = [];
  if (!Object.keys(rows).length) {
    problems.push('no AI Factory gates table');
  } else {
    const empty = GATES.filter((g) => !RESULTS.includes(rows[g]?.result));
    if (empty.length) problems.push(`gates without a result: ${empty.join(', ')}`);
    const unexplained = GATES.filter((g) => ['FAIL', 'ASK'].includes(rows[g]?.result) && !rows[g].note);
    if (unexplained.length) problems.push(`FAIL or ASK without a note: ${unexplained.join(', ')}`);
  }
  if (!sign) problems.push('gates not signed off by a person');
  return { rows, signedBy: sign?.[1] ?? null, signedOn: sign?.[2] ?? null, problems };
}

/** Ticked and open tasks (`- [x] T001` / `- [ ] T001`). */
export function taskCounts(text) {
  const t = text ?? '';
  return { done: (t.match(/^\s*- \[[xX]\] T\d{3}\b/gm) ?? []).length, open: (t.match(/^\s*- \[ \] T\d{3}\b/gm) ?? []).length };
}

/**
 * Every feature under specs/, from a project file list and a reader (shared with the build check).
 * Status: specified (spec only), planned (plan.md), in-progress (a task ticked), done (all ticked).
 */
export function collectFeatures(files, read) {
  const ids = [...new Set(files.map((f) => FEATURE_FILE.exec(f)).filter((m) => m?.[2] === 'spec').map((m) => m[1]))].sort();
  return ids.map((id) => {
    const spec = read(`specs/${id}/spec.md`) ?? '';
    const plan = files.includes(`specs/${id}/plan.md`) ? read(`specs/${id}/plan.md`) : null;
    const tasks = files.includes(`specs/${id}/tasks.md`) ? taskCounts(read(`specs/${id}/tasks.md`)) : null;
    const heading = /^#\s+(.+)$/m.exec(spec)?.[1] ?? id;
    const gates = plan === null ? null : parseGates(plan);
    let status = 'specified';
    if (tasks?.done && !tasks.open) status = 'done';
    else if (tasks?.done) status = 'in-progress';
    else if (plan !== null) status = 'planned';
    return {
      id,
      title: heading.replace(/^[^:]*specification:\s*/i, '').trim(),
      spec: `specs/${id}/spec.md`,
      status,
      clarificationsOpen: clarifications(spec).length + clarifications(plan).length,
      gatesSignedOff: Boolean(gates?.signedBy),
      gateProblems: gates?.problems ?? [],
    };
  });
}

/** The entry for the build profile: what other tools (the Management app) read. */
export const profileEntry = ({ gateProblems, ...entry }) => entry;

/** Whether the profile's `features` list matches the folders. A project without specs needs none. */
export function profileInStep(profile, features) {
  const expected = features.map(profileEntry);
  if (!profile.features && !expected.length) return true;
  return JSON.stringify(profile.features ?? []) === JSON.stringify(expected);
}

function specFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full).split(sep).join('/'));
    }
  };
  if (existsSync(join(root, 'specs'))) walk(join(root, 'specs'));
  return out.sort();
}

const reader = (root) => (f) => {
  const full = join(root, ...f.split('/'));
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
};

export const features = (root) => collectFeatures(specFiles(resolve(root)), reader(resolve(root)));

function readProfile(root) {
  const file = join(root, ...PROFILE.split('/'));
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

function fill(template, tokens) {
  const text = Object.entries(tokens).reduce((acc, [k, v]) => acc.split(k).join(v), readFileSync(join(TEMPLATES, template), 'utf8'));
  const leftover = /__[A-Z]+__/.exec(text);
  if (leftover) throw new Error(`Unreplaced token ${leftover[0]} in ${template}`);
  return text;
}

function writeNew(root, rel, text) {
  const file = join(root, ...rel.split('/'));
  if (existsSync(file)) throw new Error(`${rel} exists already: edit it instead`);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text);
  return rel;
}

function checkTitle(title) {
  if (!title?.trim() || title.length > 80 || /[\r\n]|__/.test(title)) throw new Error('--title is required (one line, at most 80 characters)');
  return title.trim();
}

const today = () => new Date().toISOString().slice(0, 10);

/** Keeps the profile's `features` in step with the folders. Returns whether it changed. */
export function syncProfile(rootDir, { check = false } = {}) {
  const root = resolve(rootDir);
  const profile = readProfile(root);
  if (!profile) throw new Error(`No ${PROFILE} in ${root}: run this in an aifactory-code project`);
  const list = features(root);
  if (profileInStep(profile, list)) return { changed: false, features: list.map(profileEntry) };
  if (!check) {
    profile.features = list.map(profileEntry);
    writeFileSync(join(root, ...PROFILE.split('/')), `${JSON.stringify(profile, null, 2)}\n`);
  }
  return { changed: true, features: list.map(profileEntry) };
}

const syncIfProfile = (root) => (readProfile(root) ? syncProfile(root) : null);

export function newFeature(rootDir, { title, input, date = today() }) {
  const root = resolve(rootDir);
  const t = checkTitle(title);
  const specs = join(root, 'specs');
  mkdirSync(specs, { recursive: true });
  if (!existsSync(join(specs, 'README.md'))) writeFileSync(join(specs, 'README.md'), readFileSync(join(TEMPLATES, 'README.md')));
  const id = `${nextId(readdirSync(specs))}-${slugify(t)}`;
  const file = writeNew(
    root,
    `specs/${id}/spec.md`,
    fill('spec.md', { __FEATURE__: t, __ID__: id, __DATE__: date, __INPUT__: (input ?? t).replace(/["\r\n]+/g, ' ').trim() }),
  );
  syncIfProfile(root);
  return { id, files: [file], branch: `feat/${id}` };
}

/** Plain-language technical context from the build profile, for the plan. */
export function technicalContext(profile) {
  if (!profile) return '- **Build profile**: none found; fill in the stack, storage, testing and hosting by hand';
  const kind = profile.solution?.kind;
  const a = profile.addons ?? {};
  const python = kind === 'agent';
  const stack = {
    web: 'TypeScript: Fastify 5 serves the React and Vite front end and /api routes, one `web` container',
    mcp: 'TypeScript: Fastify 5 with the /mcp endpoint, one `web` container',
    agent: 'Python 3.13: FastAPI and Microsoft Agent Framework with a chat page, one `web` container',
    copilot: 'Microsoft 365 Copilot declarative agent that calls an MCP server; no container',
  }[kind] ?? `${kind}`;
  const storage = !a.database
    ? 'none'
    : `PostgreSQL with an Entra token; migrations in ${python ? '`migrations/`' : '`drizzle/`'}, run as a separate command`;
  const ai = !a.ai ? 'none' : `Azure AI Foundry with the managed identity${a.agent ? '; agent actions are proposed and a person approves them' : ''}`;
  const testing =
    kind === 'copilot'
      ? '`atk validate` and the questions in `eval/questions.md`'
      : `${python ? 'pytest and ruff' : 'Vitest and ESLint'}${a.agent ? '; the evaluation set in `evals/agent.json`' : ''}`;
  const hosting = profile.target === 'customer-lz' ? "a customer's workload landing zone" : "itm8's shared platform (ai.itm8.cloud)";
  const zone = profile.zone?.confirmed ? `${profile.zone.assumption} (confirmed)` : 'not confirmed: build to Yellow';
  const asks = (profile.askItm8 ?? []).filter((x) => !x.answer).map((x) => x.item);
  return [
    `- **Stack**: ${stack}`,
    `- **Storage**: ${storage}`,
    `- **AI**: ${ai}${a.mcp ? '; MCP endpoint (read-only tools)' : ''}${a.copilot ? '; Microsoft 365 Copilot agent with a pinned tool list' : ''}`,
    `- **Testing**: ${testing}`,
    `- **Hosting**: ${hosting}; zone ${zone}`,
    `- **Users**: ${profile.users === 'external' ? 'internal and guests from outside the organisation' : 'internal only'}; personal data: ${profile.personalData ?? 'not recorded'}`,
    `- **Open "ask itm8" items**: ${asks.length ? asks.join('; ') : 'none'}`,
  ].join('\n');
}

function findFeature(root, ref) {
  const list = features(root);
  if (!list.length) throw new Error('No features in specs/: create one with "new" first');
  if (!ref) return list.at(-1);
  const match = list.filter((f) => f.id === ref || f.id.startsWith(`${String(ref).padStart(3, '0')}-`));
  if (match.length !== 1) throw new Error(`No single feature matches "${ref}": ${list.map((f) => f.id).join(', ')}`);
  return match[0];
}

export function planFeature(rootDir, { ref, date = today() } = {}) {
  const root = resolve(rootDir);
  const feature = findFeature(root, ref);
  const open = clarifications(reader(root)(feature.spec));
  if (open.length) {
    throw Object.assign(
      new Error(`${feature.spec} has ${open.length} open clarification(s). Answer them, or have a person accept an assumption under "Assumptions":\n${open.map((q) => `  - ${q}`).join('\n')}`),
      { open },
    );
  }
  const tokens = { __FEATURE__: feature.title, __ID__: feature.id, __DATE__: date };
  const gates = readFileSync(join(TEMPLATES, 'gates.md'), 'utf8').trimEnd();
  const files = [
    writeNew(root, `specs/${feature.id}/plan.md`, fill('plan.md', { ...tokens, __CONTEXT__: technicalContext(readProfile(root)), __GATES__: gates })),
  ];
  if (!existsSync(join(root, 'specs', feature.id, 'tasks.md'))) files.push(writeNew(root, `specs/${feature.id}/tasks.md`, fill('tasks.md', tokens)));
  syncIfProfile(root);
  return { id: feature.id, files };
}

export function newBug(rootDir, { title, date = today() }) {
  const root = resolve(rootDir);
  const t = checkTitle(title);
  const bugs = join(root, 'specs', 'bugs');
  const id = `${nextId(existsSync(bugs) ? readdirSync(bugs) : [], 'B')}-${slugify(t)}`;
  const file = writeNew(root, `specs/bugs/${id}/report.md`, fill('bug-report.md', { __FEATURE__: t, __ID__: id, __DATE__: date }));
  return { id, files: [file], branch: `fix/${id.toLowerCase()}` };
}

function parseArgs(argv) {
  const o = { command: argv[0], dest: '.' };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} needs a value`);
      return v;
    };
    switch (arg) {
      case '--title': o.title = value(); break;
      case '--input': o.input = value(); break;
      case '--dest': o.dest = value(); break;
      case '--date': o.date = value(); break;
      case '--check': o.check = true; break;
      case '--json': o.json = true; break;
      case '--help': case '-h': o.command = 'help'; break;
      default:
        if (arg.startsWith('--') || o.ref) throw new Error(`Unknown option ${arg}`);
        o.ref = arg;
    }
  }
  if (o.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) throw new Error('--date must be YYYY-MM-DD');
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const out = (result, text) => console.log(o.json ? JSON.stringify(result, null, 2) : text);
    switch (o.command) {
      case 'new': {
        const r = newFeature(o.dest, o);
        out(r, `Created ${r.files[0]}\nSuggested branch: ${r.branch}\nNext: fill in the spec, then /aifactory-code:plan ${r.id.slice(0, 3)}`);
        break;
      }
      case 'plan': {
        const r = planFeature(o.dest, o);
        out(r, `Created ${r.files.join(' and ')}\nNext: fill in the plan and the gates; a person signs off the gates before the build starts`);
        break;
      }
      case 'bug': {
        const r = newBug(o.dest, o);
        out(r, `Created ${r.files[0]}\nSuggested branch: ${r.branch}\nNext: write a failing test that reproduces the bug, before any fix`);
        break;
      }
      case 'list': {
        const list = features(o.dest);
        out(
          list,
          list.length
            ? list
                .map((f) => {
                  const notes = [f.clarificationsOpen ? `${f.clarificationsOpen} open clarification(s)` : '', ...f.gateProblems].filter(Boolean);
                  return `${f.id.padEnd(30)} ${f.status.padEnd(12)} ${notes.join('; ') || 'ok'}`;
                })
                .join('\n')
            : 'No features in specs/',
        );
        break;
      }
      case 'sync': {
        const r = syncProfile(o.dest, o);
        out(r, o.check ? (r.changed ? `features in ${PROFILE} are out of step: run sync` : 'In step') : r.changed ? `Updated ${PROFILE}` : 'Already in step');
        if (o.check && r.changed) process.exit(1);
        break;
      }
      case 'help':
      case undefined:
        console.log(HELP);
        break;
      default:
        throw new Error(`Unknown command ${o.command}`);
    }
  } catch (err) {
    console.error(err.message);
    console.error('Run with --help for the commands.');
    process.exit(1);
  }
}
