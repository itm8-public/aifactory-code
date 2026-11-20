import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, guard, tempDir } from './helpers.mjs';
import { findUnsafeCode } from '../lib/code-guard.mjs';

const codeGuard = (payload, env) => guard(payload, env, 'code-guard.mjs');
const write = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });
const denied = (out) => out?.hookSpecificOutput?.permissionDecision === 'deny';
const reason = (out) => out?.hookSpecificOutput?.permissionDecisionReason ?? '';

// Unsafe shapes that must be blocked, and the safe way to write the same thing, per file.
const UNSAFE = [
  ['src/server/db.ts', 'tls-off', 'const ssl = { rejectUnauthorized: false };'],
  ['src/server/env.ts', 'tls-off', "process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';"],
  ['src/server/calc.ts', 'dynamic-code', 'export const run = (s: string) => eval(s);'],
  ['src/server/calc.ts', 'dynamic-code', "export const run = new Function('a', body);"],
  ['src/server/git.ts', 'shell-string', 'execSync(`git log ${branch}`);'],
  ['src/server/git.ts', 'shell-string', "spawn('git', args, { shell: true });"],
  ['src/server/find.ts', 'sql-string', 'await client.query(`SELECT * FROM items WHERE id = ${id}`);'],
  ['src/server/find.ts', 'sql-string', "await pool.query('SELECT * FROM items WHERE id = ' + id);"],
  ['src/server/find.ts', 'sql-string', 'await prisma.$queryRawUnsafe(text);'],
  ['src/web/Note.tsx', 'raw-html', 'return <div dangerouslySetInnerHTML={{ __html: note }} />;'],
  ['src/web/note.ts', 'raw-html', 'el.innerHTML = note;'],
  ['src/server/server.ts', 'cors-any', "await app.register(cors, { origin: '*' });"],
  ['src/server/server.ts', 'cors-any', "reply.header('Access-Control-Allow-Origin', '*');"],
  ['app/fetch.py', 'tls-off', 'httpx.get(url, verify=False)'],
  ['app/calc.py', 'dynamic-code', 'value = eval(text)'],
  ['app/load.py', 'dynamic-code', 'data = pickle.loads(body)'],
  ['app/git.py', 'shell-string', 'subprocess.run(cmd, shell=True)'],
  ['app/db.py', 'sql-string', 'cur.execute(f"SELECT * FROM items WHERE id = {item_id}")'],
  ['app/db.py', 'sql-string', 'cur.execute("SELECT * FROM items WHERE id = %s" % item_id)'],
  ['app/main.py', 'cors-any', 'app.add_middleware(CORSMiddleware, allow_origins=["*"])'],
];

const SAFE = [
  ['src/server/find.ts', 'await db.execute(sql`SELECT * FROM items WHERE id = ${id}`);'],
  ['src/server/find.ts', "await client.query('SELECT * FROM items WHERE id = $1', [id]);"],
  ['src/server/git.ts', "execFile('git', ['log', branch]);"],
  ['src/server/parse.ts', 'const m = /^v(\\d+)$/.exec(`${prefix}${tag}`);'],
  ['src/web/Note.tsx', 'return <p>{note}</p>;'],
  ['app/db.py', 'cur.execute("SELECT * FROM items WHERE id = %s", (item_id,))'],
  ['app/model.py', 'model.eval()'],
  ['app/config.py', 'data = yaml.load(text, Loader=yaml.SafeLoader)'],
];

describe('code guard', () => {
  let app;
  before(() => {
    app = join(tempDir(), 'app');
    mkdirSync(join(app, '.aifactory'), { recursive: true });
    writeFileSync(join(app, '.aifactory', 'build-profile.json'), '{}');
  });
  after(cleanup);

  it('denies each unsafe shape inside an AI Factory project, naming AF-31 and the safe way', () => {
    for (const [file, id, text] of UNSAFE) {
      const out = codeGuard(write(join(app, file), `// x\n${text}\n`));
      assert.ok(denied(out), `${file}: ${text}`);
      assert.match(reason(out), new RegExp(`AF-31 ${id}`), text);
      assert.match(reason(out), /line 2 of the new text/);
    }
  });

  it('allows the safe way to write the same thing', () => {
    for (const [file, text] of SAFE) assert.equal(codeGuard(write(join(app, file), text)), null, text);
  });

  it('skips test files, which carry attack payloads as data', () => {
    for (const file of ['src/server/test/find.test.ts', 'src/server/find.spec.ts', 'tests/test_db.py']) {
      assert.equal(codeGuard(write(join(app, file), 'client.query(`SELECT ${payload}`); cur.execute(f"x {y}")')), null, file);
    }
  });

  it('denies infrastructure files, deploy steps and direct AI providers', () => {
    assert.match(reason(codeGuard(write(join(app, 'infra/main.bicep'), 'param x string'))), /AF-09/);
    assert.match(reason(codeGuard(write(join(app, 'main.tf'), ''))), /AF-09/);
    assert.match(reason(codeGuard(write(join(app, '.github/workflows/ci.yml'), 'steps:\n  - uses: azure/login@v2\n'))), /AF-09/);
    assert.equal(codeGuard(write(join(app, '.github/workflows/ci.yml'), 'steps:\n  - run: npm test\n')), null);
    assert.match(reason(codeGuard(write(join(app, 'src/server/llm.ts'), "const u = 'https://api.openai.com/v1';"))), /AF-19/);
    assert.match(reason(codeGuard(write(join(app, '.env.example'), 'OPENAI_API_KEY='))), /AF-19/);
  });

  it('checks Edit and MultiEdit text, and relative paths from the hook cwd', () => {
    const file = join(app, 'src/server/x.ts');
    assert.ok(denied(codeGuard({ tool_name: 'Edit', tool_input: { file_path: file, new_string: 'eval(s)' } })));
    assert.ok(denied(codeGuard({ tool_name: 'MultiEdit', tool_input: { file_path: file, edits: [{ new_string: 'ok' }, { new_string: 'eval(s)' }] } })));
    assert.ok(denied(codeGuard({ ...write('src/server/x.ts', 'eval(s)'), cwd: app })));
  });

  it('is active in a project being replatformed too', () => {
    const repo = join(tempDir(), 'customer');
    mkdirSync(join(repo, '.aifactory'), { recursive: true });
    writeFileSync(join(repo, '.aifactory', 'replatform-plan.json'), '{}');
    assert.ok(denied(codeGuard(write(join(repo, 'api/db.py'), 'requests.get(u, verify=False)'))));
  });

  it('stays out of folders that are not AI Factory projects', () => {
    const other = tempDir();
    assert.equal(codeGuard(write(join(other, 'infra/main.bicep'), 'param x string')), null);
    assert.equal(codeGuard(write(join(other, 'src/x.ts'), 'eval(s)')), null);
  });

  it('fails open on bad input, ignores other tools and turns off with AIFACTORY_CODE_GUARD=off', () => {
    assert.equal(codeGuard('not json'), null);
    assert.equal(codeGuard({ tool_name: 'Read', tool_input: { file_path: join(app, 'a.ts') } }), null);
    assert.equal(codeGuard(write(join(app, 'src/server/x.ts'), 'eval(s)'), { AIFACTORY_CODE_GUARD: 'off' }), null);
  });

  it('findUnsafeCode reports the first line and skips languages it does not know', () => {
    assert.deepEqual(findUnsafeCode('a.ts', 'ok\nok\neval(x)').line, 3);
    assert.equal(findUnsafeCode('README.md', 'eval(x)'), null);
    assert.equal(findUnsafeCode('a.ts', ''), null);
  });
});
