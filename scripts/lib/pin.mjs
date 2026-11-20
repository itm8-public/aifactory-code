// Shared helpers for the pinned build rules: local integrity checks only.
// rules/build-kit/* are mirrored byte-for-byte from itm8's internal AI Factory build-kit.
// Remote re-pinning against the upstream repository is an itm8-internal maintenance step and is
// not part of this public copy, so only the offline integrity helpers remain here.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ROOT, readJson } from '../scaffold.mjs';

export const RULES_MAX_CHARS = 12_000;

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const loadPin = () => readJson(join(PLUGIN_ROOT, 'rules', 'pin.json'));

/** Problems with the local pinned copies, or an empty list. */
export function localPinProblems(pin = loadPin()) {
  const problems = [];
  for (const f of pin.files) {
    const buf = readFileSync(join(PLUGIN_ROOT, ...f.local.split('/')));
    if (sha256(buf) !== f.sha256) problems.push(`${f.local} does not match its pinned hash (never edit it by hand)`);
    const text = buf.toString('utf8');
    if ([...text].length > RULES_MAX_CHARS) problems.push(`${f.local} is over ${RULES_MAX_CHARS} characters`);
    if (text.includes('\r')) problems.push(`${f.local} has CR line endings (check .gitattributes)`);
  }
  const agents = pin.files.find((f) => f.upstream.endsWith('AGENTS.md'));
  if (!agents) problems.push('pin.json has no AGENTS.md entry');
  else if (!readFileSync(join(PLUGIN_ROOT, ...agents.local.split('/')), 'utf8').includes('\n## This project\n')) {
    problems.push(`${agents.local} has no "## This project" section for the scaffold to fill`);
  }
  return problems;
}

/** Problems with the vendored third-party skills (vendor/*.pin.json), or an empty list. */
export function vendorPinProblems() {
  const dir = join(PLUGIN_ROOT, 'vendor');
  const problems = [];
  for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.pin.json')) : []) {
    const pin = readJson(join(dir, name));
    if (!/^[0-9a-f]{40}$/.test(pin.source?.commit ?? '')) problems.push(`${name}: source.commit must be a full commit sha`);
    for (const f of pin.files ?? []) {
      const path = join(PLUGIN_ROOT, ...f.local.split('/'));
      // sha256 is the upstream file; localSha256 is our copy where a pin records an edit to it.
      if (!existsSync(path)) problems.push(`${f.local} is missing (${name})`);
      else if (sha256(readFileSync(path)) !== (f.localSha256 ?? f.sha256)) problems.push(`${f.local} does not match its pinned hash (never edit it; use vendor:sync)`);
    }
  }
  return problems;
}
