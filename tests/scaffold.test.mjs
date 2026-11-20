import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { PLUGIN_ROOT, applyConditions, flagsOf, lockSignature, scaffold } from '../scripts/scaffold.mjs';
import { runChecks } from '../scripts/build-check.mjs';
import { cleanup, project, read, tempDir } from './helpers.mjs';

function files(dir, base = dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) files(full, base, out);
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}
const textFiles = (dir) => files(dir).filter((f) => !/\.(png|svg)$/.test(f));

const VARIANTS = [
  { name: 'web', opts: {} },
  { name: 'web + db', opts: { db: true } },
  { name: 'web + db + ai', opts: { db: true, ai: true } },
  { name: 'web, everything', opts: { db: true, ai: true, agent: true, mcp: true } },
  { name: 'mcp', opts: { kind: 'mcp' } },
  { name: 'mcp + db', opts: { kind: 'mcp', db: true } },
  { name: 'python agent', opts: { kind: 'agent' } },
  { name: 'web + mcp + copilot', opts: { db: true, mcp: true, copilot: true } },
  { name: 'mcp + copilot', opts: { kind: 'mcp', copilot: true } },
  { name: 'copilot for an existing MCP server', opts: { kind: 'copilot', mcpUrl: 'https://tools.example.com/mcp' } },
];

describe('scaffold', () => {
  after(cleanup);

  for (const v of VARIANTS) {
    describe(v.name, () => {
      const dir = project(v.opts);
      const all = files(dir);
      const flags = flagsOf({ kind: 'web', ...v.opts });

      it('leaves no template tokens or condition markers', () => {
        for (const f of textFiles(dir)) {
          const text = read(dir, f);
          assert.doesNotMatch(text, /__[A-Z][A-Z_]*__/, f);
          assert.doesNotMatch(text, /@(if|endif)\b/, f);
          assert.doesNotMatch(text, /aifactory-app-template/, f);
        }
      });

      it('writes the files for the chosen parts only', () => {
        assert.ok(all.includes('.gitignore') && !all.includes('_gitignore'));
        assert.ok(all.includes('specs/README.md'));
        if (flags.standalone) {
          assert.ok(all.includes('appPackage/manifest.json') && all.includes('scripts/sync-tools.mjs'));
          assert.ok(all.includes('.github/workflows/ci.yml') && all.includes('CLAUDE.md'));
          assert.ok(!all.includes('Dockerfile') && !all.includes('package.json'));
          assert.match(read(dir, 'env/.env.dev'), /MCP_URL=https:\/\/tools\.example\.com\/mcp/);
          return;
        }
        assert.ok(all.includes('Dockerfile') && all.includes('.env.example') && all.includes('AGENTS.md'));
        assert.equal(all.includes('copilot/appPackage/ai-plugin.json'), flags.copilot);
        assert.equal(all.includes('scripts/copilot-tools.ts'), flags.copilot);
        assert.ok(!all.includes('copilot/CLAUDE.md') && !all.includes('copilot/.github/workflows/ci.yml'));
        if (flags.python) {
          assert.ok(all.includes('uv.lock') && all.includes('app/agent.py') && all.includes('migrations/0001_init.sql'));
          assert.ok(all.includes('app/static/design/tokens/colors.css'));
          assert.ok(!all.includes('package.json'));
          return;
        }
        assert.equal(all.includes('src/web/main.tsx'), flags.spa);
        // The pull request verdict: in every TypeScript project, on pull requests only, never blocking.
        assert.ok(all.includes('scripts/pr-verdict.ts') && all.includes('scripts/pr-verdict.test.ts'));
        assert.match(
          read(dir, '.github/workflows/ci.yml'),
          /name: Pull request verdict\s+id: verdict\s+if: \$\{\{ !cancelled\(\) && github\.event_name == 'pull_request' \}\}\s+continue-on-error: true\s/,
        );
        assert.equal(all.includes('src/web/design/components/Button.tsx'), flags.spa);
        assert.equal(all.includes('drizzle/0000_init.sql'), flags.db);
        assert.equal(all.includes('src/server/routes/items.ts'), flags.spa && flags.db);
        assert.equal(all.includes('src/server/lib/ai.ts'), flags.ai);
        assert.equal(all.includes('src/server/lib/agent.ts'), flags.agent);
        assert.equal(all.includes('evals/agent.json'), flags.agent);
        assert.equal(all.includes('src/server/routes/mcp.ts'), flags.mcp);
      });

      it('fills AGENTS.md and the build profile', () => {
        const agents = read(dir, 'AGENTS.md');
        assert.match(agents.split('\n')[0], /^<!-- aifactory-code \d+\.\d+\.\d+ · build-kit [\d.]+ @ [0-9a-f]{7} -->$/);
        assert.match(agents, new RegExp(`Database: PostgreSQL, ${flags.db ? 'yes' : 'no'}`));
        assert.match(agents, /## Stop and ask a person first/);
        for (const name of ['PERFORMANCE.md', 'GUARD.md']) {
          assert.equal(read(dir, name), readFileSync(join(PLUGIN_ROOT, 'rules', 'build-kit', name), 'utf8'), `${name} is the pinned copy`);
        }
        const profile = JSON.parse(read(dir, '.aifactory/build-profile.json'));
        assert.equal(profile.solution.kind, v.opts.kind ?? 'web');
        assert.deepEqual(profile.addons, {
          database: flags.db,
          ai: flags.ai,
          agent: flags.agent,
          mcp: flags.mcp,
          copilot: Boolean(flags.copilot),
        });
        if (flags.standalone) {
          assert.deepEqual(profile.apps, []);
          assert.equal(profile.copilot.package, 'appPackage');
        } else {
          assert.equal(profile.apps[0].port, 8080);
          assert.equal(profile.apps[0].healthPath, '/healthz');
          if (flags.copilot) assert.equal(profile.copilot.package, 'copilot/appPackage');
        }
        assert.equal(profile.zone.confirmed, false);
        assert.deepEqual(profile.features, []);
      });

      it('produces JSON that parses and a matching lock file', () => {
        for (const f of all.filter((x) => x.endsWith('.json'))) JSON.parse(read(dir, f));
        if (flags.copilot) {
          const pkg = flags.standalone ? 'appPackage' : 'copilot/appPackage';
          const tools = JSON.parse(read(dir, `${pkg}/mcp-tools.json`)).tools.map((t) => t.name);
          const plugin = JSON.parse(read(dir, `${pkg}/ai-plugin.json`));
          assert.deepEqual(plugin.functions.map((f) => f.name), tools);
          assert.deepEqual(plugin.runtimes[0].run_for_functions, tools);
          assert.equal(plugin.runtimes[0].auth.type, 'OAuthPluginVault');
          assert.ok(plugin.name_for_human.length <= 20);
          assert.match(plugin.namespace, /^[A-Za-z0-9_]+$/);
          if (!flags.standalone) assert.deepEqual(tools, flags.db ? ['get_service_info', 'search_items'] : ['get_service_info']);
        }
        if (flags.standalone) return;
        if (flags.python) {
          assert.match(read(dir, 'uv.lock'), /name = "test-app"/);
          return;
        }
        const lock = JSON.parse(read(dir, 'package-lock.json'));
        const pkg = JSON.parse(read(dir, 'package.json'));
        assert.equal(lock.name, pkg.name);
        assert.deepEqual(Object.keys(lock.packages[''].dependencies).sort(), Object.keys(pkg.dependencies).sort());
        assert.deepEqual(Object.keys(lock.packages[''].devDependencies).sort(), Object.keys(pkg.devDependencies).sort());
      });

      it('passes the build check', () => {
        const report = runChecks(dir, { today: '2026-10-29' });
        assert.equal(report.counts.FAIL, 0, JSON.stringify(report.results.filter((r) => r.status === 'FAIL')));
        // A fresh standalone Copilot agent has no tools pinned yet: that is the one expected WARN.
        const warns = report.results.filter((r) => r.status === 'WARN').map((r) => r.id);
        assert.deepEqual(warns, flags.standalone ? ['AF-29'] : []);
        assert.equal(report.counts.SKIP, flags.standalone ? 9 : 0);
      });
    });
  }

  it('picks a lock per dependency signature', () => {
    assert.equal(lockSignature(flagsOf({ kind: 'web' })), 'spa');
    assert.equal(lockSignature(flagsOf({ kind: 'web', db: true, ai: true, agent: true })), 'spa-db');
    assert.equal(lockSignature(flagsOf({ kind: 'web', db: true, mcp: true })), 'spa-db-mcp');
    assert.equal(lockSignature(flagsOf({ kind: 'mcp' })), 'api-mcp');
  });

  it('refuses unsafe or invalid choices', () => {
    const dest = () => join(tempDir(), 'x');
    const base = { title: 'T', target: 'lz-online' };
    assert.throws(() => scaffold({ ...base, dest: dest(), ai: true }), /--ai needs --db/);
    assert.throws(() => scaffold({ ...base, dest: dest(), db: true, agent: true }), /--agent needs --ai/);
    assert.throws(() => scaffold({ ...base, dest: dest(), mcp: true }), /--mcp needs --db/);
    assert.throws(() => scaffold({ ...base, dest: dest(), kind: 'mcp', ai: true }), /--kind mcp takes only --db/);
    assert.throws(() => scaffold({ ...base, dest: dest(), kind: 'agent', db: true }), /--kind agent always has/);
    assert.throws(() => scaffold({ ...base, dest: dest(), kind: 'bot' }), /--kind must be/);
    assert.throws(() => scaffold({ ...base, dest: dest(), db: true, copilot: true }), /--copilot needs --mcp/);
    assert.throws(() => scaffold({ ...base, dest: dest(), kind: 'copilot' }), /--mcp-url/);
    assert.throws(() => scaffold({ ...base, dest: dest(), kind: 'copilot', mcpUrl: 'http://insecure.example/mcp' }), /--mcp-url/);
    assert.throws(() => scaffold({ ...base, dest: dest(), kind: 'copilot', mcpUrl: 'https://x.example/mcp', db: true }), /takes no add-ons/);
    assert.throws(() => scaffold({ ...base, dest: dest(), mcpUrl: 'https://x.example/mcp' }), /only for --kind copilot/);
    assert.throws(() => scaffold({ ...base, dest: dest(), name: 'Way-Too-Long-Name' }), /--name/);
    assert.throws(() => scaffold({ ...base, dest: dest(), personalData: 'yes' }), /stop and ask itm8/);
    assert.throws(() => scaffold({ title: 'T', target: 'customer-lz', dest: dest() }), /--consent/);
    const full = dest();
    mkdirSync(full);
    writeFileSync(join(full, 'x.txt'), 'x');
    assert.throws(() => scaffold({ ...base, dest: full }), /not empty/);
    assert.ok(!existsSync(join(full, 'package.json')));
  });

  it('handles nested and inline conditions', () => {
    const text = ['a', '// @if db', 'b', '# @if ai', 'c', '# @endif', '// @endif', 'd <!-- @if !db -->e<!-- @endif -->'].join('\n');
    assert.equal(applyConditions(text, { db: true, ai: false }), 'a\nb\nd ');
    assert.equal(applyConditions(text, { db: false }), 'a\nd e');
    assert.throws(() => applyConditions('// @if db\nx', {}), /without @endif/);
  });
});
