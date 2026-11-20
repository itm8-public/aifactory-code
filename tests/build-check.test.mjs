import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { RULES } from '../scripts/build-check/rules.mjs';
import { runChecks } from '../scripts/build-check.mjs';
import { newFeature, planFeature } from '../scripts/feature.mjs';
import { cleanup, copyOf, edit, project, read, write } from './helpers.mjs';

// One mutation of a clean project per rule: it must make exactly that rule report. `base` picks
// the clean project: the full web app (default), the MCP server, or the Python agent.
const MUTATIONS = {
  'AF-01': { run: (d) => rmSync(join(d, 'AGENTS.md')) },
  'AF-02': { run: (d) => rmSync(join(d, 'Dockerfile')) },
  'AF-03': { run: (d) => edit(d, 'Dockerfile', (t) => t.replace('EXPOSE 8080', 'EXPOSE 3000')) },
  'AF-04': { run: (d) => edit(d, 'src/server/routes/health.ts', (t) => t.replaceAll("'/healthz'", "'/health'")) },
  'AF-05': { run: (d) => edit(d, 'Dockerfile', (t) => t.replace('USER node\n', '')) },
  'AF-06': { run: (d) => edit(d, 'Dockerfile', (t) => t.replace(/@sha256:[0-9a-f]+/, '')) },
  'AF-07': { run: (d) => edit(d, 'src/server/server.ts', (t) => `${t}\nsetInterval(() => {}, 60_000);\n`) },
  'AF-08': { run: (d) => write(d, 'src/server/lib/export.ts', "import { writeFileSync } from 'node:fs';\nwriteFileSync('/tmp/x', '');\n") },
  'AF-09': {
    run: (d) => {
      mkdirSync(join(d, 'infra'));
      write(d, 'infra/main.bicep', "param location string = 'swedencentral'\n");
    },
  },
  'AF-10': { run: (d) => rmSync(join(d, '.env.example')) },
  'AF-11': { run: (d) => write(d, 'src/server/leak.ts', `export const k = \`${'-----BEGIN ' + 'PRIVATE KEY-----'}\`;\n`) },
  'AF-12': { run: (d) => write(d, 'src/server/keys.ts', 'export const c = new AzureKeyCredential(process.env.SEARCH_KEY!);\n') },
  'AF-13': { run: (d) => edit(d, 'package.json', (t) => t.replace('"dependencies": {', '"dependencies": {\n    "bcrypt": "^6.0.0",')) },
  'AF-14': { run: (d) => write(d, 'src/server/sb.ts', 'export const u = () => supabase.auth.getUser();\n') },
  'AF-15': { run: (d) => edit(d, 'src/server/config.ts', (t) => t.replaceAll('APP_ENVIRONMENT', 'APP_ENV')) },
  'AF-16': {
    run: (d) => edit(d, 'package.json', (t) => t.replace('"dependencies": {', '"dependencies": {\n    "better-sqlite3": "^12.0.0",')),
  },
  'AF-17': {
    run: (d) =>
      edit(d, 'src/server/server.ts', (t) => `import { runMigrations } from './db/migrate';\n${t}\nawait runMigrations(config as never);\n`),
  },
  'AF-18': { run: (d) => write(d, 'drizzle/0009_vector.sql', 'CREATE EXTENSION IF NOT EXISTS vector;\n') },
  'AF-19': { run: (d) => write(d, 'src/server/llm.ts', "export const url = 'https://api.openai.com/v1/chat/completions';\n") },
  'AF-20': { run: (d) => edit(d, 'src/server/security.ts', (t) => t.replace(`"frame-ancestors 'none'",`, '')) },
  'AF-21': {
    run: (d) =>
      edit(d, 'src/web/index.html', (t) =>
        t.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Fira+Sans" rel="stylesheet" />\n</head>'),
      ),
  },
  'AF-22': { run: (d) => rmSync(join(d, 'package-lock.json')) },
  'AF-23': {
    // An MCP server without a database that claims to have one: nothing writes an audit row.
    base: 'mcp',
    run: (d) => edit(d, '.aifactory/build-profile.json', (t) => t.replaceAll('"database": false', '"database": true')),
  },
  'AF-24': { run: (d) => write(d, 'src/web/session.ts', "export const keep = (t: string) => localStorage.setItem('token', t);\n") },
  'AF-25': { run: (d) => edit(d, 'package.json', (t) => t.replace(/\n\s*"lint": "[^"]*",/, '')) },
  'AF-26': { run: (d) => edit(d, 'evals/agent.json', (t) => JSON.stringify({ ...JSON.parse(t), cases: JSON.parse(t).cases.slice(0, 5) })) },
  'AF-28': {
    // Dynamic discovery instead of a pinned list.
    run: (d) =>
      edit(d, 'copilot/appPackage/ai-plugin.json', (t) => {
        const plugin = JSON.parse(t);
        plugin.runtimes[0].run_for_functions = ['*'];
        return JSON.stringify(plugin, null, 2);
      }),
  },
  'AF-29': {
    base: 'copilot',
    run: (d) => write(d, 'appPackage/mcp-tools.json', JSON.stringify({ tools: [] })),
  },
  'AF-30': {
    // A planned feature whose gates nobody has filled in or signed.
    run: (d) => {
      const { id } = newFeature(d, { title: 'Export orders', date: '2026-10-29' });
      edit(d, `specs/${id}/spec.md`, (t) => t.replace(/\[NEEDS CLARIFICATION:[^\]]*\]/g, 'answered'));
      planFeature(d, { ref: id, date: '2026-10-29' });
    },
  },
  'AF-31': { run: (d) => write(d, 'src/server/lib/report.ts', 'export const find = (db: any, id: string) => db.query(`SELECT * FROM items WHERE id = ${id}`);\n') },
  'AF-32': { run: (d) => edit(d, 'AGENTS.md', (t) => t.replace(/^- Browser support:.*\n/m, '')) },
  'AF-27': {
    run: (d) => {
      for (const f of ['src/server/routes/agent.ts', 'src/server/lib/agent.ts', 'src/server/db/schema.ts', 'src/server/test/helpers.ts']) {
        edit(d, f, (t) => t.replaceAll('agentActions', 'agentProposalsTable').replaceAll('agent_actions', 'agent_proposals').replaceAll('/decision', '/ok'));
      }
    },
  },
};

// Python agent: the same rules where a rule has a Python form.
const PY_MUTATIONS = {
  'AF-04': (d) => edit(d, 'app/main.py', (t) => t.replaceAll('"/healthz"', '"/health"')),
  'AF-07': (d) => write(d, 'app/jobs.py', 'from apscheduler.schedulers.background import BackgroundScheduler\n'),
  'AF-15': (d) => edit(d, 'app/settings.py', (t) => t.replaceAll('APP_ENVIRONMENT', 'APP_ENV')),
  'AF-17': (d) => edit(d, 'app/main.py', (t) => `${t}\nimport asyncio\nfrom .migrate import run_migrations\nasyncio.run(run_migrations(None, []))\n`),
  'AF-19': (d) => write(d, 'app/llm.py', 'URL = "https://api.anthropic.com/v1/messages"\n'),
  'AF-22': (d) => rmSync(join(d, 'uv.lock')),
  'AF-25': (d) => edit(d, 'pyproject.toml', (t) => t.replaceAll('[tool.ruff', '[tool.notruff')),
  'AF-26': (d) => edit(d, 'evals/agent.json', (t) => JSON.stringify({ ...JSON.parse(t), cases: [] })),
  'AF-27': (d) =>
    edit(d, 'app/main.py', (t) => t.replaceAll('agent_actions', 'agent_proposals').replaceAll('/decision', '/ok')),
  'AF-31': (d) => write(d, 'app/fetch.py', 'import httpx\n\n\nasync def get(url):\n    return await httpx.AsyncClient(verify=False).get(url)\n'),
  'AF-32': (d) => edit(d, 'AGENTS.md', (t) => t.replace(/^- Browser support:.*\n/m, '')),
};

describe('build check', () => {
  const clean = {};
  before(() => {
    clean.web = project({ db: true, ai: true, agent: true, mcp: true, copilot: true });
    clean.mcp = project({ kind: 'mcp' });
    clean.python = project({ kind: 'agent' });
    // A standalone Copilot agent with its tools already pinned.
    clean.copilot = project({ kind: 'copilot', mcpUrl: 'https://tools.example.com/mcp' });
    write(clean.copilot, 'appPackage/mcp-tools.json', read(clean.web, 'copilot/appPackage/mcp-tools.json'));
    write(clean.copilot, 'appPackage/ai-plugin.json', read(clean.web, 'copilot/appPackage/ai-plugin.json'));
  });
  after(cleanup);

  for (const kind of ['web', 'mcp', 'python', 'copilot']) {
    it(`passes every rule on a fresh ${kind} project`, () => {
      const report = runChecks(clean[kind], { today: '2026-10-29' });
      assert.deepEqual(report.results.filter((r) => r.status !== 'PASS' && r.status !== 'SKIP'), []);
    });
  }

  it('skips the container rules for a standalone Copilot agent only', () => {
    const skipped = (dir) => runChecks(dir, { today: '2026-10-29' }).results.filter((r) => r.status === 'SKIP').map((r) => r.id);
    assert.deepEqual(skipped(clean.copilot), ['AF-02', 'AF-03', 'AF-04', 'AF-05', 'AF-06', 'AF-07', 'AF-08', 'AF-10', 'AF-20']);
    assert.deepEqual(skipped(clean.web), []);
  });

  it('AF-28 catches a Copilot package out of step with the server', () => {
    const dir = copyOf(clean.web);
    edit(dir, 'src/server/lib/mcp-tools.ts', (t) => t.replace("name: 'search_items'", "name: 'find_items'"));
    assert.equal(runChecks(dir, { today: '2026-10-29' }).results.find((r) => r.id === 'AF-28').status, 'FAIL');
  });

  it('AF-28 catches a missing disclaimer and an un-ignored SSO id', () => {
    const dir = copyOf(clean.web);
    edit(dir, 'copilot/appPackage/declarativeAgent.json', (t) => {
      const agent = JSON.parse(t);
      delete agent.disclaimer;
      return JSON.stringify(agent);
    });
    write(dir, 'copilot/.gitignore', 'appPackage/build/\n');
    const result = runChecks(dir, { today: '2026-10-29' }).results.find((r) => r.id === 'AF-28');
    assert.equal(result.status, 'FAIL');
    assert.match(result.detail, /disclaimer/);
    assert.match(result.detail, /gitignored/);
  });

  it('has a failing case for every rule', () => {
    assert.deepEqual(RULES.map((r) => r.id).sort(), Object.keys(MUTATIONS).sort());
  });

  for (const rule of RULES) {
    it(`${rule.id} reports ${rule.severity}: ${rule.title}`, () => {
      const m = MUTATIONS[rule.id];
      const dir = copyOf(clean[m.base ?? 'web']);
      m.run(dir);
      const result = runChecks(dir, { today: '2026-10-29' }).results.find((r) => r.id === rule.id);
      assert.equal(result.status, rule.severity, `${rule.id}: ${result.detail ?? ''}`);
    });
  }

  for (const [id, run] of Object.entries(PY_MUTATIONS)) {
    it(`${id} also catches the Python agent`, () => {
      const dir = copyOf(clean.python);
      run(dir);
      const result = runChecks(dir, { today: '2026-10-29' }).results.find((r) => r.id === id);
      assert.notEqual(result.status, 'PASS', `${id} passed on a broken Python project`);
    });
  }

  it('honours a waiver until its date, then reports again', () => {
    const dir = copyOf(clean.web);
    MUTATIONS['AF-08'].run(dir);
    mkdirSync(join(dir, '.aifactory'), { recursive: true });
    write(dir, '.aifactory/build-check.json', JSON.stringify({ waivers: [{ id: 'AF-08', reason: 'Temporary export', until: '2026-12-31' }] }));
    assert.equal(runChecks(dir, { today: '2026-10-29' }).results.find((r) => r.id === 'AF-08').status, 'WAIVED');
    assert.equal(runChecks(dir, { today: '2027-01-01' }).results.find((r) => r.id === 'AF-08').status, 'WARN');
  });

  it('AF-32 accepts another Baseline target and skips projects without pages', () => {
    const dir = copyOf(clean.web);
    edit(dir, 'AGENTS.md', (t) => t.replace('Baseline Widely available.', 'Baseline 2024.'));
    assert.equal(runChecks(dir, { today: '2026-10-29' }).results.find((r) => r.id === 'AF-32').status, 'PASS');
    assert.doesNotMatch(read(clean.mcp, 'AGENTS.md'), /Baseline target/);
    assert.equal(runChecks(clean.mcp, { today: '2026-10-29' }).results.find((r) => r.id === 'AF-32').status, 'PASS');
  });

  it('keeps reading the profile it relies on', () => {
    assert.match(read(clean.web, '.aifactory/build-profile.json'), /"agent": true/);
  });
});
