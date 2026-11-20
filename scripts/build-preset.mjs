#!/usr/bin/env node
// Generates the GitHub Spec Kit preset's `append` templates from the plugin's own spec templates,
// so the preset and /aifactory-code:spec|plan never drift. Usage: node scripts/build-preset.mjs
// [--check]. The constitution and the implement wrapper in the preset are written by hand.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLUGIN_ROOT } from './scaffold.mjs';

export const PRESET_DIR = join(PLUGIN_ROOT, 'presets', 'speckit-aifactory');
const SPECS = join(PLUGIN_ROOT, 'templates', 'specs');
const HEADER = '<!-- itm8 AI Factory preset (aifactory-code plugin). Generated from templates/specs: do not edit here. -->';

const source = (name) => readFileSync(join(SPECS, name), 'utf8');

/** The `## <heading>` section of a Markdown file, up to the next `## `. */
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`## ${heading}`));
  if (start < 0) throw new Error(`No "## ${heading}" section`);
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start, end < 0 ? undefined : end).join('\n').trimEnd();
}

/** Published path in the preset -> content. */
export function presetFiles() {
  const buildCheck = source('tasks.md')
    .split('\n')
    .find((l) => l.includes('Run the AI Factory build check'))
    ?.replace(/^- \[ \] T\d{3} /, '');
  if (!buildCheck) throw new Error('templates/specs/tasks.md has no build check task');
  return {
    'templates/spec-template.md': [HEADER, '', section(source('spec.md'), 'Data and zone'), ''].join('\n'),
    'templates/plan-template.md': [
      HEADER,
      '<!-- These gates are the Constitution Check for an AI Factory project. -->',
      '',
      source('gates.md').trimEnd(),
      '',
    ].join('\n'),
    'templates/tasks-template.md': [
      HEADER,
      '',
      '## AI Factory',
      '',
      '- The final task of every tasks.md, after Polish:',
      `  ${buildCheck}`,
      '- Tasks that change agent behaviour also update the evaluation set; tasks that change MCP tools also',
      '  regenerate the Copilot tool list when the project has one.',
      '',
    ].join('\n'),
  };
}

/** Preset files that differ from what the templates generate. */
export function presetDrift() {
  return Object.entries(presetFiles())
    .filter(([rel, text]) => {
      try {
        return readFileSync(join(PRESET_DIR, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n') !== text;
      } catch {
        return true;
      }
    })
    .map(([rel]) => rel);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--check')) {
    const drift = presetDrift();
    for (const rel of drift) console.error(`presets/speckit-aifactory/${rel} differs: run node scripts/build-preset.mjs`);
    process.exit(drift.length ? 1 : 0);
  }
  for (const [rel, text] of Object.entries(presetFiles())) writeFileSync(join(PRESET_DIR, ...rel.split('/')), text);
  console.log('Preset templates written');
}
