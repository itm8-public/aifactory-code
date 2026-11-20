// Pins the MCP tools into the Copilot package: copilot/appPackage/mcp-tools.json from MCP_TOOLS,
// then copilot/scripts/sync-tools.mjs updates ai-plugin.json. `npm run copilot:tools` writes;
// `npm run copilot:check` (CI) fails while the package and the server differ. A new tool reaches
// Copilot users only through a release and the Microsoft 365 admin's approval.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { MCP_TOOLS } from '../src/server/lib/mcp-tools';

const check = process.argv.includes('--check');
const file = new URL('../copilot/appPackage/mcp-tools.json', import.meta.url);
const tools = MCP_TOOLS.map((t) => ({
  name: t.name,
  title: t.title,
  description: t.description,
  // What a caller may send: fields with a default are optional.
  inputSchema: z.toJSONSchema(t.input, { io: 'input' }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}));
const next = { tools };

if (check) {
  const current = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    console.error('copilot/appPackage/mcp-tools.json is out of date: run npm run copilot:tools');
    process.exit(1);
  }
} else {
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Pinned ${tools.length} tool(s): ${tools.map((t) => t.name).join(', ')}`);
}

const sync = fileURLToPath(new URL('../copilot/scripts/sync-tools.mjs', import.meta.url));
execFileSync(process.execPath, [sync, ...(check ? ['--check'] : [])], { stdio: 'inherit' });
