#!/usr/bin/env node
// Self-check of the plugin repository: manifests, skill and command frontmatter, links,
// the rules pin, and template markers. Offline, no dependencies. Exit 1 on any problem.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { PLUGIN_ROOT, applyConditions, readJson } from './scaffold.mjs';
import { localPinProblems, vendorPinProblems } from './lib/pin.mjs';
import { PRESET_DIR, presetDrift } from './build-preset.mjs';

const problems = [];
const problem = (msg) => problems.push(msg);
const rel = (p) => relative(PLUGIN_ROOT, p).split(sep).join('/');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function frontmatter(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fields;
}

// Manifests
const plugin = readJson(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'));
const market = readJson(join(PLUGIN_ROOT, '.claude-plugin', 'marketplace.json'));
if (!/^[a-z][a-z0-9-]*$/.test(plugin.name)) problem('plugin.json: name must be kebab-case');
if (!/^\d+\.\d+\.\d+$/.test(plugin.version)) problem('plugin.json: version must be semver');
for (const k of ['description', 'repository']) if (!plugin[k]) problem(`plugin.json: ${k} is missing`);
if (!plugin.author?.name) problem('plugin.json: author.name is missing');
if (!market.owner?.name) problem('marketplace.json: owner.name is missing');
const entry = market.plugins?.find((p) => p.name === plugin.name);
if (!entry || entry.source !== './') problem('marketplace.json: must list this plugin with source "./"');
// A plugin from another repository is pinned to a commit, so an update is a reviewed change here.
for (const p of market.plugins ?? []) {
  if (typeof p.source === 'object' && !/^[0-9a-f]{40}$/.test(p.source.sha ?? '')) problem(`marketplace.json: ${p.name} must pin its source to a full commit sha`);
}
if (!readFileSync(join(PLUGIN_ROOT, 'CHANGELOG.md'), 'utf8').includes(`## ${plugin.version}`)) {
  problem(`CHANGELOG.md has no "## ${plugin.version}" section`);
}

// Skills and commands
for (const dir of readdirSync(join(PLUGIN_ROOT, 'skills'))) {
  const file = join(PLUGIN_ROOT, 'skills', dir, 'SKILL.md');
  const fm = existsSync(file) ? frontmatter(file) : null;
  if (!fm) {
    problem(`skills/${dir}/SKILL.md: missing or no frontmatter`);
    continue;
  }
  if (fm.name !== dir) problem(`skills/${dir}/SKILL.md: name must be "${dir}"`);
  if (!fm.description || fm.description.length > 1024) problem(`skills/${dir}/SKILL.md: description missing or over 1024 characters`);
}
for (const file of readdirSync(join(PLUGIN_ROOT, 'commands'))) {
  const fm = frontmatter(join(PLUGIN_ROOT, 'commands', file));
  if (!fm?.description) problem(`commands/${file}: frontmatter description is missing`);
}

// Hooks
const hooks = readJson(join(PLUGIN_ROOT, 'hooks', 'hooks.json'));
for (const groups of Object.values(hooks.hooks)) {
  for (const g of groups) {
    for (const h of g.hooks) {
      const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)/.exec(h.command);
      if (!m || !existsSync(join(PLUGIN_ROOT, ...m[1].split('/')))) problem(`hooks.json: script not found for "${h.command}"`);
    }
  }
}

// Relative links in Markdown (templates are checked after scaffolding, in the tests)
const markdown = walk(PLUGIN_ROOT).filter((f) => f.endsWith('.md') && !rel(f).startsWith('templates/') && !rel(f).startsWith('rules/build-kit/'));
for (const file of markdown) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target) || target.startsWith('${')) continue;
    if (!existsSync(resolve(dirname(file), target))) problem(`${rel(file)}: broken link ${m[1]}`);
  }
}

// Rules pin
for (const p of localPinProblems()) problem(`rules: ${p}`);
for (const p of vendorPinProblems()) problem(`vendor: ${p}`);

// Templates: balanced markers, and JSON that parses in every combination
const combos = [{}, { db: true }, { db: true, ai: true }];
for (const file of walk(join(PLUGIN_ROOT, 'templates'))) {
  if (/\.(png|jpe?g|svg|woff2?)$/i.test(file) || rel(file).includes('/locks/')) continue;
  const text = readFileSync(file, 'utf8');
  for (const flags of combos) {
    let out;
    try {
      out = applyConditions(text, flags);
    } catch (err) {
      problem(`${rel(file)}: ${err.message}`);
      break;
    }
    if (file.endsWith('.json')) {
      try {
        JSON.parse(out);
      } catch {
        problem(`${rel(file)}: not valid JSON with ${JSON.stringify(flags)}`);
      }
    }
  }
}
for (const dir of readdirSync(join(PLUGIN_ROOT, 'templates'))) {
  if (dir === 'specs') continue;
  const manifest = readJson(join(PLUGIN_ROOT, 'templates', dir, 'template.json'));
  for (const [sig, file] of Object.entries(manifest.locks ?? {})) {
    try {
      const lock = readJson(join(PLUGIN_ROOT, 'templates', dir, ...file.split('/')));
      if (lock.name !== 'aifactory-app-template') problem(`templates/${dir}/${file}: name must be aifactory-app-template`);
    } catch {
      problem(`templates/${dir}/${file} (lock for ${sig}) is missing or not valid JSON`);
    }
  }
}

// Spec Kit preset: generated files in step, every listed file present, same version as the plugin
for (const f of presetDrift()) problem(`presets/speckit-aifactory/${f} differs from templates/specs: run node scripts/build-preset.mjs`);
const presetYml = readFileSync(join(PRESET_DIR, 'preset.yml'), 'utf8');
for (const m of presetYml.matchAll(/^\s+file:\s*"([^"]+)"/gm)) {
  if (!existsSync(join(PRESET_DIR, ...m[1].split('/')))) problem(`presets/speckit-aifactory/preset.yml: ${m[1]} is missing`);
}
if (!presetYml.includes(`version: "${plugin.version}"`)) problem(`presets/speckit-aifactory/preset.yml: version must be "${plugin.version}"`);

if (problems.length) {
  for (const p of problems) console.error(`FAIL ${p}`);
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`Plugin ${plugin.name} ${plugin.version}: all checks passed`);
