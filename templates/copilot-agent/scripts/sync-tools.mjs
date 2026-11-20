#!/usr/bin/env node
// Keeps the plugin manifest in step with the pinned tool list.
//   appPackage/mcp-tools.json   the MCP server's tools/list result: { "tools": [ ... ] }
//   appPackage/ai-plugin.json   functions[] and run_for_functions[] must name exactly those tools
// `node scripts/sync-tools.mjs` rewrites ai-plugin.json; `--check` only reports and exits 1 on a
// difference. The tool list is pinned on purpose: a new tool reaches users only through a release
// and the Microsoft 365 admin's approval. No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../appPackage/', import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));

const tools = read('mcp-tools.json').tools ?? [];
const plugin = read('ai-plugin.json');
const functions = tools.map((t) => ({ name: t.name, description: t.description }));
const names = tools.map((t) => t.name);
const next = {
  ...plugin,
  functions,
  runtimes: plugin.runtimes.map((r) => (r.type === 'RemoteMCPServer' ? { ...r, run_for_functions: names } : r)),
};

if (process.argv.includes('--check')) {
  const same = JSON.stringify(plugin.functions) === JSON.stringify(functions) &&
    plugin.runtimes.every((r) => r.type !== 'RemoteMCPServer' || JSON.stringify(r.run_for_functions) === JSON.stringify(names));
  if (!same) {
    console.error('appPackage/ai-plugin.json does not match appPackage/mcp-tools.json: run node scripts/sync-tools.mjs');
    process.exit(1);
  }
  if (names.length === 0) console.error('No tools pinned yet: export the MCP server tools/list into appPackage/mcp-tools.json');
  console.log(`ai-plugin.json matches ${names.length} pinned tool(s)`);
} else {
  writeFileSync(new URL('ai-plugin.json', dir), `${JSON.stringify(next, null, 2)}\n`);
  console.log(`ai-plugin.json now lists ${names.length} tool(s): ${names.join(', ') || '(none)'}`);
}
