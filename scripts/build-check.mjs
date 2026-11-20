#!/usr/bin/env node
// AI Factory build check: PASS, FAIL, WARN or WAIVED per rule id for a project folder.
// Usage: node scripts/build-check.mjs [folder] [--json]. Exit code 1 when any rule FAILs.
// Deterministic, read-only, no network, no dependencies.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RULES } from './build-check/rules.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.venv', 'venv', '__pycache__', '.next', '.turbo']);
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|eot|mp4|mp3|wasm|lockb)$/i;
const MAX_BYTES = 1024 * 1024;

function gitFiles(root, args) {
  try {
    const out = execFileSync('git', ['-C', root, 'ls-files', '-z', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

function walk(root, dir = root, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(root, full, out);
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

export function projectContext(rootDir) {
  const root = resolve(rootDir);
  const tracked = gitFiles(root, []);
  const files = (gitFiles(root, ['--cached', '--others', '--exclude-standard']) ?? walk(root))
    .filter((f) => !f.split('/').some((p) => SKIP_DIRS.has(p)) && existsSync(join(root, f)))
    .sort();
  const cache = new Map();
  const read = (f) => {
    if (!cache.has(f)) {
      const full = join(root, f);
      let text = null;
      if (!BINARY.test(f) && existsSync(full)) {
        const st = statSync(full);
        if (st.isFile() && st.size <= MAX_BYTES) text = readFileSync(full, 'utf8');
      }
      cache.set(f, text);
    }
    return cache.get(f);
  };
  const json = (f) => {
    try {
      const t = read(f);
      return t === null ? null : JSON.parse(t);
    } catch {
      return null;
    }
  };
  return { root, files, tracked, read, json };
}

function waivers(ctx, today) {
  const list = ctx.json('.aifactory/build-check.json')?.waivers;
  const active = new Map();
  if (!Array.isArray(list)) return active;
  for (const w of list) {
    if (typeof w?.id === 'string' && typeof w.reason === 'string' && w.reason.trim() && typeof w.until === 'string' && w.until >= today) {
      active.set(w.id, w);
    }
  }
  return active;
}

export function runChecks(rootDir, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) throw new Error(`Not a folder: ${rootDir}`);
  const ctx = projectContext(rootDir);
  const waived = waivers(ctx, today);
  // A standalone Copilot agent is not a container: container rules do not apply.
  const noContainer = ctx.json('.aifactory/build-profile.json')?.solution?.kind === 'copilot';
  const ordered = [...RULES].sort((a, b) => a.id.localeCompare(b.id));
  const results = ordered.map((rule) => {
    if (noContainer && rule.container) {
      return { id: rule.id, title: rule.title, status: 'SKIP', detail: 'Not a container' };
    }
    let outcome;
    try {
      outcome = rule.check(ctx);
    } catch (err) {
      outcome = { ok: false, detail: `The check itself failed: ${err.message}` };
    }
    const base = { id: rule.id, title: rule.title };
    if (outcome.ok) return { ...base, status: 'PASS' };
    const waiver = waived.get(rule.id);
    if (waiver) return { ...base, status: 'WAIVED', detail: `${waiver.reason} (until ${waiver.until})`, files: outcome.files ?? [] };
    return { ...base, status: rule.severity, detail: outcome.detail, files: outcome.files ?? [] };
  });
  const counts = { PASS: 0, FAIL: 0, WARN: 0, WAIVED: 0, SKIP: 0 };
  for (const r of results) counts[r.status]++;
  return { root: ctx.root, results, counts };
}

function print(report) {
  console.log(`AI Factory build check: ${report.root}\n`);
  for (const r of report.results) {
    console.log(`${r.status.padEnd(6)} ${r.id}  ${r.title}`);
    if (r.status !== 'PASS' && r.status !== 'SKIP') {
      console.log(`         ${r.detail}`);
      for (const f of r.files ?? []) console.log(`         - ${f}`);
    }
  }
  const c = report.counts;
  console.log(`\n${c.PASS} pass, ${c.FAIL} fail, ${c.WARN} warn, ${c.WAIVED} waived${c.SKIP ? `, ${c.SKIP} not applicable` : ''}`);
  console.log('Rule ids: skills/aifactory-code/reference/rule-ids.md in the aifactory-code plugin.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const folder = args.find((a) => !a.startsWith('--')) ?? '.';
  try {
    const report = runChecks(folder);
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else print(report);
    process.exit(report.counts.FAIL > 0 ? 1 : 0);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
}
