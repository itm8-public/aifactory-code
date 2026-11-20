#!/usr/bin/env node
// Maintainers only: third-party skills, pinned by commit and SHA-256 per file in
// vendor/<name>.pin.json. Shipped unchanged, or with the few edits a pin records as localSha256.
// Public GitHub repositories only, so no token is needed.
//   npm run vendor:drift              exit 3 when an upstream branch moved, or a newer release
//                                     than a pinned tag exists
//   npm run vendor:sync -- <name> --ref <commit|branch>
//                                     re-download every pinned file and rewrite the pin
// After a sync: read the upstream diff before you commit (it is instructions for an agent with a
// shell), bump the plugin version and add a CHANGELOG line.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ROOT } from './scaffold.mjs';
import { sha256 } from './lib/pin.mjs';

const VENDOR = join(PLUGIN_ROOT, 'vendor');
const pins = () =>
  readdirSync(VENDOR)
    .filter((f) => f.endsWith('.pin.json'))
    .map((f) => ({ file: join(VENDOR, f), name: f.replace(/\.pin\.json$/, ''), pin: JSON.parse(readFileSync(join(VENDOR, f), 'utf8')) }));

async function github(path) {
  const res = await fetch(`https://api.github.com/repos/${path}`, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API answered ${res.status} for ${path}`);
  return res.json();
}

async function drift() {
  let moved = 0;
  for (const { name, pin } of pins()) {
    // A pin on a release tag follows the latest release; a pin on a branch follows its head.
    if (pin.source.tag) {
      const latest = (await github(`${pin.source.repo}/releases/latest`)).tag_name;
      if (latest === pin.source.tag) console.log(`${name}: current (${latest})`);
      else {
        moved++;
        console.log(`${name}: upstream released ${latest} (pinned ${pin.source.tag}); read the diff, then update the copies and the pin by hand`);
      }
      continue;
    }
    const head = (await github(`${pin.source.repo}/commits/${encodeURIComponent(pin.source.ref)}`)).sha;
    if (head === pin.source.commit) console.log(`${name}: current (${head.slice(0, 7)})`);
    else {
      moved++;
      console.log(`${name}: upstream ${pin.source.ref} moved ${pin.source.commit.slice(0, 7)} -> ${head.slice(0, 7)}; review the diff, then npm run vendor:sync -- ${name} --ref ${head}`);
    }
  }
  // Third-party plugins the marketplace lists by repository and release tag.
  const market = JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  for (const { name, source } of market.plugins.filter((p) => p.source?.source === 'github' && p.source.ref)) {
    const latest = (await github(`${source.repo}/releases/latest`)).tag_name;
    if (latest === source.ref) console.log(`${name} (marketplace): current (${latest})`);
    else {
      moved++;
      console.log(`${name} (marketplace): upstream released ${latest} (pinned ${source.ref}); read the diff, then move ref and sha in marketplace.json`);
    }
  }
  return moved ? 3 : 0;
}

async function sync(name, ref) {
  const entry = pins().find((p) => p.name === name);
  if (!entry || !ref) throw new Error('Usage: npm run vendor:sync -- <name> --ref <commit|branch>');
  const { pin } = entry;
  // A sync writes upstream bytes over the copies, which would drop edits a pin records.
  if (pin.files.some((f) => f.localSha256)) throw new Error(`${name} has local edits (localSha256 in the pin): update it by hand, as its note says`);
  const commit =(await github(`${pin.source.repo}/commits/${encodeURIComponent(ref)}`)).sha;
  for (const f of pin.files) {
    const res = await fetch(`https://raw.githubusercontent.com/${pin.source.repo}/${commit}/${f.upstream}`);
    if (!res.ok) throw new Error(`${f.upstream}@${commit.slice(0, 7)}: ${res.status} (a file was renamed or removed upstream: edit the pin by hand)`);
    const bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(PLUGIN_ROOT, ...f.local.split('/')), bytes);
    f.sha256 = sha256(bytes);
  }
  pin.source.commit = commit;
  pin.pinnedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(entry.file, `${JSON.stringify(pin, null, 2)}\n`);
  console.log(`Pinned ${name} to ${commit.slice(0, 7)}. Upstream may have added files: compare its tree with the pin.`);
  return 0;
}

const args = process.argv.slice(2);
const at = args.indexOf('--ref');
const run = args.includes('--drift') ? drift() : sync(args[0], at >= 0 ? args[at + 1] : undefined);
// exitCode, not exit(): exiting while fetch's sockets close aborts Node on Windows.
run.then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(err.message);
    process.exitCode = 2;
  },
);
