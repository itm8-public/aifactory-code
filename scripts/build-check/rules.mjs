// The AI Factory build check rules. Each rule looks at the project context and returns
// { ok: true } or { ok: false, detail, files }. Ids map to the build rules in
// skills/aifactory-code/reference/rule-ids.md. Heuristics, not proof: a person judges WARNs.
import { findSecret, isAgentsToolkitEnv, isDotEnvFile } from '../../lib/secrets.mjs';
import { DEPLOY_STEP, DIRECT_AI, INFRA_FILE, findUnsafeCode } from '../../lib/code-guard.mjs';
import { collectFeatures, profileInStep } from '../feature.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|py)$/;
const isTest = (f) => /(^|\/)(test|tests|__tests__)\//.test(f) || /\.(test|spec)\.[a-z]+$/.test(f);
const isWeb = (f) => /(^|\/)(web|client|frontend|public|static)\//.test(f) || /\.(tsx|jsx)$/.test(f);
const isConfig = (f) => /(^|\/)[^/]+\.config\.[a-z]+$/.test(f);

/** The sentence that states which browser features the project may use without a fallback. */
const BASELINE_TARGET = /This project's Baseline target is Baseline [^.\n]+\./;

const pass = () => ({ ok: true });
const fail = (detail, files = []) => ({ ok: false, detail, files: files.slice(0, 5) });

/** Files whose text matches the pattern, with the first matching line. */
function grep(ctx, files, re) {
  const hits = [];
  for (const f of files) {
    const text = ctx.read(f);
    if (text === null) continue;
    const lines = text.split('\n');
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) hits.push(`${f}:${i + 1}`);
  }
  return hits;
}

/** Developer tooling that never ships in the image: generators, evaluation runners, the Copilot package. */
const isTooling = (f) => /^(scripts|copilot|evals)\//.test(f);
const serverCode = (ctx) =>
  ctx.files.filter((f) => CODE.test(f) && !isTest(f) && !isWeb(f) && !isConfig(f) && !isTooling(f));
const allCode = (ctx) => ctx.files.filter((f) => CODE.test(f));
const dockerfiles = (ctx) => ctx.files.filter((f) => /(^|\/)Dockerfile(\.[\w-]+)?$/.test(f));

function dependencies(ctx) {
  const pkg = ctx.json('package.json');
  return pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
}

function hasDep(ctx, names) {
  const deps = Object.keys(dependencies(ctx));
  return deps.filter((d) => names.some((n) => (n.endsWith('/*') ? d.startsWith(n.slice(0, -1)) : d === n)));
}

/** FROM lines with ARG defaults resolved and build-stage aliases skipped. */
function baseImages(text) {
  const args = {};
  const stages = new Set();
  const images = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const arg = /^ARG\s+([A-Za-z_][A-Za-z0-9_]*)=(\S+)/i.exec(line);
    if (arg) args[arg[1]] = arg[2];
    const from = /^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (from) {
      const image = from[1].replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_, n) => args[n] ?? '');
      if (!stages.has(image) && image !== 'scratch') images.push(image);
      if (from[2]) stages.add(from[2]);
    }
  }
  return images;
}

export const RULES = [
  {
    id: 'AF-01',
    severity: 'FAIL',
    title: 'Build rules and build profile present',
    check(ctx) {
      const agents = ctx.read('AGENTS.md');
      if (!agents || !agents.includes('# AI Factory build rules') || !agents.includes('## This project')) {
        return fail('AGENTS.md with the AI Factory build rules and a "This project" section is missing');
      }
      const profile = ctx.json('.aifactory/build-profile.json');
      const needsApp = profile?.solution?.kind !== 'copilot';
      if (!profile || !Array.isArray(profile.apps) || (needsApp && profile.apps.length === 0)) {
        return fail('.aifactory/build-profile.json is missing or has no apps');
      }
      return pass();
    },
  },
  {
    id: 'AF-02',
    container: true,
    severity: 'FAIL',
    title: 'Dockerfile for the app',
    check: (ctx) => (dockerfiles(ctx).length ? pass() : fail('No Dockerfile: each app is a Linux container')),
  },
  {
    id: 'AF-03',
    container: true,
    severity: 'FAIL',
    title: 'Listens on port 8080',
    check(ctx) {
      const other = grep(ctx, dockerfiles(ctx), /^\s*EXPOSE\s+(?!8080\b)\d+/i);
      if (other.length) return fail('The image exposes a port other than 8080', other);
      const seen = grep(ctx, [...dockerfiles(ctx), ...serverCode(ctx)], /\b8080\b/);
      return seen.length ? pass() : fail('Nothing shows the app listening on 8080 (EXPOSE 8080 and the default port)');
    },
  },
  {
    id: 'AF-04',
    container: true,
    severity: 'FAIL',
    title: '/healthz route',
    check: (ctx) =>
      grep(ctx, serverCode(ctx), /['"`]\/healthz['"`]/).length
        ? pass()
        : fail('No GET /healthz: the platform probes one health path, without sign-in or database'),
  },
  {
    id: 'AF-05',
    container: true,
    severity: 'FAIL',
    title: 'Image runs as a non-root user',
    check(ctx) {
      const bad = [];
      for (const f of dockerfiles(ctx)) {
        const users = ctx
          .read(f)
          .split('\n')
          .filter((l) => /^\s*USER\s+/i.test(l));
        const last = users.at(-1)?.trim().split(/\s+/)[1];
        if (!last || last === 'root' || last === '0' || last.startsWith('0:')) bad.push(f);
      }
      return bad.length ? fail('The final stage needs a USER line with a non-root user', bad) : pass();
    },
  },
  {
    id: 'AF-06',
    container: true,
    severity: 'WARN',
    title: 'Base images pinned by digest',
    check(ctx) {
      const unpinned = [];
      for (const f of dockerfiles(ctx)) {
        for (const image of baseImages(ctx.read(f))) if (!image.includes('@sha256:')) unpinned.push(`${f}: ${image}`);
      }
      return unpinned.length ? fail('Pin each base image by digest (image:tag@sha256:...)', unpinned) : pass();
    },
  },
  {
    id: 'AF-07',
    container: true,
    severity: 'FAIL',
    title: 'No timers or schedulers in the server',
    check(ctx) {
      const hits = grep(
        ctx,
        serverCode(ctx),
        /\bsetInterval\s*\(|from\s+['"](node-cron|cron|agenda|node-schedule)['"]|require\(['"](node-cron|cron|agenda|node-schedule)['"]\)|\bapscheduler\b|\bBackgroundScheduler\b/,
      );
      return hits.length
        ? fail('Scheduled work is a run-once command with a database lock, not a timer in the server; ask itm8', hits)
        : pass();
    },
  },
  {
    id: 'AF-08',
    container: true,
    severity: 'WARN',
    title: 'No writes to the container disk',
    check(ctx) {
      const hits = grep(
        ctx,
        serverCode(ctx).filter((f) => !/migrat/i.test(f)),
        /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream)\s*\(|multer\(\s*\{\s*dest|\bopen\([^)]*['"]w['"]/,
      );
      return hits.length ? fail('The disk is lost on restart and not shared between replicas', hits) : pass();
    },
  },
  {
    id: 'AF-09',
    severity: 'FAIL',
    title: 'No infrastructure or deployment code',
    check(ctx) {
      const infra = ctx.files.filter((f) => INFRA_FILE.test(f));
      const pipelines = ctx.files.filter((f) => /(^|\/)\.github\/workflows\/[^/]+\.ya?ml$|azure-pipelines[^/]*\.ya?ml$/.test(f));
      const deploys = grep(ctx, pipelines, DEPLOY_STEP);
      const all = [...infra, ...deploys];
      return all.length ? fail("Infrastructure and deploy pipelines come from itm8's Wizard, not the app repository", all) : pass();
    },
  },
  {
    id: 'AF-10',
    container: true,
    severity: 'FAIL',
    title: '.env.example present, .env never committed',
    check(ctx) {
      if (!ctx.files.includes('.env.example')) return fail('.env.example with the setting names is missing');
      const ignore = ctx.read('.gitignore') ?? '';
      if (!/^\s*\.env(\*|\.\*)?\s*$/m.test(ignore)) return fail('.gitignore must ignore .env');
      const tracked = (ctx.tracked ?? []).filter((f) => isDotEnvFile(f) && !isAgentsToolkitEnv(f));
      return tracked.length ? fail('A .env file is committed: remove it and rotate every value in it', tracked) : pass();
    },
  },
  {
    id: 'AF-11',
    severity: 'FAIL',
    title: 'No secret-shaped values',
    check(ctx) {
      const hits = [];
      for (const f of ctx.files) {
        if (isDotEnvFile(f) && !isAgentsToolkitEnv(f) && !(ctx.tracked ?? []).includes(f)) continue;
        const hit = findSecret(ctx.read(f) ?? '');
        if (hit) hits.push(`${f}:${hit.line} (${hit.rule})`);
      }
      return hits.length ? fail('Remove the value, rotate it, and read it from a setting instead', hits) : pass();
    },
  },
  {
    id: 'AF-12',
    severity: 'FAIL',
    title: 'No key-based Azure access',
    check(ctx) {
      const files = [...allCode(ctx).filter((f) => !isTest(f)), '.env.example'].filter((f) => ctx.files.includes(f));
      const hits = grep(
        ctx,
        files,
        /\bAzureKeyCredential\b|\bAzureNamedKeyCredential\b|\bStorageSharedKeyCredential\b|['"]api-key['"]\s*:|\b[A-Z0-9_]*(AZURE|OPENAI|COGNITIVE|SEARCH|STORAGE|COSMOS|FOUNDRY)[A-Z0-9_]*_(API_)?KEY\b|\bPGPASSWORD\b|\bDATABASE_PASSWORD\b/,
      );
      return hits.length ? fail('Use DefaultAzureCredential (the managed identity), never keys or passwords', hits) : pass();
    },
  },
  {
    id: 'AF-13',
    severity: 'FAIL',
    title: 'No own login system',
    check(ctx) {
      const deps = hasDep(ctx, ['passport-local', 'bcrypt', 'bcryptjs', 'argon2', 'next-auth', '@auth/core', '@clerk/*', 'auth0', '@auth0/*', 'lucia', 'better-auth']);
      const code = grep(ctx, allCode(ctx), /from\s+['"]firebase\/auth['"]|\bcreateUserWithEmailAndPassword\b/);
      const all = [...deps.map((d) => `package.json: ${d}`), ...code];
      return all.length ? fail('People sign in with Entra ID through Easy Auth; build no login, sign-up or passwords', all) : pass();
    },
  },
  {
    id: 'AF-14',
    severity: 'FAIL',
    title: 'No Supabase, Firebase or Base44 backend',
    check(ctx) {
      const deps = hasDep(ctx, ['@supabase/supabase-js', '@supabase/*', 'firebase', 'firebase-admin', '@base44/*']);
      const code = grep(
        ctx,
        ctx.files.filter((f) => CODE.test(f) || f.endsWith('.sql')),
        /\bsupabase\.(auth|from|storage)\b|\bauth\.users\b|\bauth\.uid\(\)|\bbase44\./,
      );
      const all = [...deps.map((d) => `package.json: ${d}`), ...code];
      return all.length ? fail('The platform hosts containers and PostgreSQL only; move this logic into the app', all) : pass();
    },
  },
  {
    id: 'AF-15',
    severity: 'FAIL',
    title: 'Dev sign-in bypass refused in Azure',
    check(ctx) {
      const code = allCode(ctx).filter((f) => !isTest(f));
      const users = code.filter((f) => /\bDEV_AUTH_BYPASS\b/.test(ctx.read(f) ?? ''));
      if (!users.length) return pass();
      const guarded = users.some((f) => /\bAPP_ENVIRONMENT\b/.test(ctx.read(f) ?? ''));
      return guarded ? pass() : fail('Refuse DEV_AUTH_BYPASS at startup when APP_ENVIRONMENT is set', users);
    },
  },
  {
    id: 'AF-16',
    severity: 'FAIL',
    title: 'PostgreSQL only',
    check(ctx) {
      const deps = hasDep(ctx, ['sqlite3', 'better-sqlite3', '@libsql/client', 'mongodb', 'mongoose', 'mysql', 'mysql2', 'lowdb', 'nedb', '@seald-io/nedb']);
      const prisma = grep(ctx, ctx.files.filter((f) => f.endsWith('.prisma')), /provider\s*=\s*"(sqlite|mongodb|mysql|sqlserver)"/);
      const all = [...deps.map((d) => `package.json: ${d}`), ...prisma];
      return all.length ? fail('Business data goes in PostgreSQL', all) : pass();
    },
  },
  {
    id: 'AF-17',
    severity: 'FAIL',
    title: 'No migrations at startup',
    check(ctx) {
      const code = serverCode(ctx).filter((f) => !/migrat/i.test(f));
      const hits = grep(
        ctx,
        code,
        /drizzle-orm\/[\w-]+\/migrator|\brunMigrations\s*\(|\brun_migrations\s*\(|\.sync\(\s*\{?\s*(force|alter)?|synchronize:\s*true|\bmigrate\.latest\(|\bcreate_all\s*\(|alembic\.command\.upgrade/,
      );
      const start = ctx.json('package.json')?.scripts?.start ?? '';
      if (/migrat|prisma\s+db\s+push/.test(start)) hits.push('package.json: scripts.start');
      return hits.length ? fail('Migrations run as a separate command (the migration job), never when the app starts', hits) : pass();
    },
  },
  {
    id: 'AF-18',
    severity: 'FAIL',
    title: 'No PostgreSQL extensions',
    check(ctx) {
      const hits = grep(ctx, ctx.files.filter((f) => f.endsWith('.sql') || CODE.test(f)), /create\s+extension/i);
      return hits.length ? fail('No extension is allow-listed; use gen_random_uuid() and ask itm8', hits) : pass();
    },
  },
  {
    id: 'AF-19',
    severity: 'FAIL',
    title: 'No direct AI providers',
    check(ctx) {
      const files = [...allCode(ctx), '.env.example'].filter((f) => ctx.files.includes(f));
      const hits = grep(ctx, files, DIRECT_AI);
      const deps = hasDep(ctx, ['@anthropic-ai/sdk', '@google/generative-ai', '@google/genai', '@mistralai/mistralai', 'cohere-ai']);
      const all = [...hits, ...deps.map((d) => `package.json: ${d}`)];
      return all.length ? fail('Use Azure AI Foundry with the managed identity (EU Data Zone or regional deployments)', all) : pass();
    },
  },
  {
    id: 'AF-20',
    container: true,
    severity: 'WARN',
    title: 'Security headers',
    check(ctx) {
      const code = serverCode(ctx);
      const csp = grep(ctx, code, /frame-ancestors/i);
      const hsts = grep(ctx, code, /strict-transport-security/i);
      return csp.length && hsts.length
        ? pass()
        : fail('Send a Content-Security-Policy with frame-ancestors and Strict-Transport-Security from the server');
    },
  },
  {
    id: 'AF-21',
    severity: 'FAIL',
    title: 'No third-party font or script CDNs',
    check(ctx) {
      const files = ctx.files.filter((f) => /\.(html|css|scss|ts|tsx|js|jsx)$/.test(f) && !isTest(f));
      const hits = grep(ctx, files, /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|use\.typekit\.net/);
      return hits.length ? fail("Self-host fonts and scripts: the CSP allows the app's own origin only", hits) : pass();
    },
  },
  {
    id: 'AF-22',
    severity: 'FAIL',
    title: 'Lock file committed',
    check(ctx) {
      if (ctx.files.includes('package.json')) {
        return ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].some((f) => ctx.files.includes(f))
          ? pass()
          : fail('Commit the npm lock file (package-lock.json)');
      }
      if (ctx.files.includes('pyproject.toml')) {
        return ['uv.lock', 'poetry.lock'].some((f) => ctx.files.includes(f)) ? pass() : fail('Commit uv.lock or poetry.lock');
      }
      return pass();
    },
  },
  {
    id: 'AF-23',
    severity: 'WARN',
    title: 'Audit log written by the app',
    check(ctx) {
      if (!ctx.json('.aifactory/build-profile.json')?.addons?.database) return pass();
      return grep(ctx, serverCode(ctx), /\baudit/i).length
        ? pass()
        : fail('Record who changed what in an append-only audit table, in the same transaction as the change');
    },
  },
  {
    id: 'AF-24',
    severity: 'WARN',
    title: 'No tokens in browser storage',
    check(ctx) {
      const hits = grep(ctx, ctx.files.filter((f) => CODE.test(f)), /(localStorage|sessionStorage)\.setItem\([^)]*(token|jwt|secret|password)/i);
      return hits.length ? fail('Sign-in uses the Easy Auth cookie; keep no tokens in the browser', hits) : pass();
    },
  },
  {
    id: 'AF-25',
    severity: 'FAIL',
    title: 'build, test and lint scripts',
    check(ctx) {
      const pkg = ctx.json('package.json');
      if (pkg) {
        const missing = ['build', 'test', 'lint'].filter((s) => !pkg.scripts?.[s]);
        return missing.length ? fail(`package.json is missing scripts: ${missing.join(', ')}`) : pass();
      }
      const pyproject = ctx.read('pyproject.toml');
      if (pyproject !== null) {
        const missing = [
          ['[tool.pytest', 'pytest configuration'],
          ['[tool.ruff', 'ruff configuration'],
        ].filter(([marker]) => !pyproject.includes(marker));
        return missing.length
          ? fail(`pyproject.toml needs ${missing.map(([, what]) => what).join(' and ')} so tests and lint run without prompts`)
          : pass();
      }
      return pass();
    },
  },
  {
    id: 'AF-26',
    severity: 'FAIL',
    title: 'Agent: evaluation set of at least 20 cases',
    check(ctx) {
      if (!ctx.json('.aifactory/build-profile.json')?.addons?.agent) return pass();
      let cases = 0;
      for (const f of ctx.files.filter((x) => /^evals\/[^/]+\.(json|jsonl)$/.test(x))) {
        if (f.endsWith('.jsonl')) cases += (ctx.read(f) ?? '').split('\n').filter((l) => l.trim()).length;
        else cases += ctx.json(f)?.cases?.length ?? 0;
      }
      return cases >= 20 ? pass() : fail(`evals/ holds ${cases} synthetic cases; keep at least 20, and a command that scores them`);
    },
  },
  {
    id: 'AF-28',
    severity: 'FAIL',
    title: 'Copilot agent: Entra SSO and a pinned tool list in step with the server',
    check(ctx) {
      const profile = ctx.json('.aifactory/build-profile.json');
      if (!profile?.addons?.copilot) return pass();
      const standalone = profile.solution?.kind === 'copilot';
      const dir = profile.copilot?.package ?? (standalone ? 'appPackage' : 'copilot/appPackage');
      const problems = [];
      const file = (name) => {
        const json = ctx.json(`${dir}/${name}`);
        if (!json) problems.push(`${dir}/${name} is missing or not valid JSON`);
        return json ?? {};
      };
      file('manifest.json');
      const agent = file('declarativeAgent.json');
      const plugin = file('ai-plugin.json');
      const tools = (file('mcp-tools.json').tools ?? []).map((t) => t.name);
      const runtime = (plugin.runtimes ?? []).find((r) => r.type === 'RemoteMCPServer');
      if (!runtime) problems.push('ai-plugin.json has no RemoteMCPServer runtime');
      else {
        if (runtime.auth?.type !== 'OAuthPluginVault') problems.push('the MCP runtime must use Entra SSO (auth type OAuthPluginVault)');
        if ((runtime.run_for_functions ?? []).includes('*')) problems.push('dynamic tool discovery is on: pin the tools (run_for_functions lists them)');
        const fns = (plugin.functions ?? []).map((f) => f.name);
        if (JSON.stringify(fns) !== JSON.stringify(tools) || JSON.stringify(runtime.run_for_functions ?? []) !== JSON.stringify(tools)) {
          problems.push('ai-plugin.json functions and run_for_functions differ from mcp-tools.json: run scripts/sync-tools.mjs');
        }
      }
      if (!agent.disclaimer?.text) problems.push('declarativeAgent.json needs a disclaimer that answers are AI-generated');
      if (!standalone) {
        const source = ctx.read('src/server/lib/mcp-tools.ts') ?? '';
        const server = [...source.matchAll(/name:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
        if (JSON.stringify([...server].sort()) !== JSON.stringify([...tools].sort())) {
          problems.push('the pinned tools differ from the server\'s MCP_TOOLS: run npm run copilot:tools');
        }
      }
      const ignore = ctx.read(standalone ? '.gitignore' : 'copilot/.gitignore') ?? '';
      if (!ignore.includes('env/.env.*.user')) problems.push('env/.env.*.user (the SSO registration id) must be gitignored');
      return problems.length ? fail(problems.join('; ')) : pass();
    },
  },
  {
    id: 'AF-29',
    severity: 'WARN',
    title: 'Copilot agent: tools pinned',
    check(ctx) {
      const profile = ctx.json('.aifactory/build-profile.json');
      if (!profile?.addons?.copilot) return pass();
      const dir = profile.copilot?.package ?? 'appPackage';
      const tools = ctx.json(`${dir}/mcp-tools.json`)?.tools ?? [];
      return tools.length
        ? pass()
        : fail("No tools pinned yet: export the MCP server's tools/list into mcp-tools.json and run scripts/sync-tools.mjs");
    },
  },
  {
    id: 'AF-27',
    severity: 'FAIL',
    title: 'Agent: actions wait for human approval',
    check(ctx) {
      if (!ctx.json('.aifactory/build-profile.json')?.addons?.agent) return pass();
      const code = serverCode(ctx);
      const store = grep(ctx, code, /agent_actions|agentActions/);
      const decision = grep(ctx, code, /\/decision['"`]|\/decision"/);
      return store.length && decision.length
        ? pass()
        : fail('Tools that send, pay, write or delete must only propose; a person approves in the app before the server runs them');
    },
  },
  {
    id: 'AF-30',
    severity: 'WARN',
    title: 'Feature specs: clarifications answered, gates signed off',
    check(ctx) {
      const features = collectFeatures(ctx.files, ctx.read);
      const problems = [];
      for (const f of features) {
        if (f.status !== 'specified' && f.clarificationsOpen) problems.push(`${f.id}: ${f.clarificationsOpen} open clarification(s) after planning`);
        for (const p of f.gateProblems) problems.push(`${f.id}: ${p}`);
      }
      const profile = ctx.json('.aifactory/build-profile.json');
      if (profile && !profileInStep(profile, features)) problems.push('features in the build profile are out of step with specs/: run feature.mjs sync');
      return problems.length ? fail('A person answers open questions and signs off the AI Factory gates before the build', problems) : pass();
    },
  },  {
    id: 'AF-31',
    severity: 'FAIL',
    title: 'No unsafe code shapes',
    check(ctx) {
      const hits = [];
      for (const f of allCode(ctx)) {
        const hit = findUnsafeCode(f, ctx.read(f) ?? '');
        if (hit) hits.push(`${f}:${hit.line} (${hit.what})`);
      }
      return hits.length
        ? fail('Use the safe way: parameters for SQL, escaping for HTML, argument arrays without a shell, TLS checks on, no CORS', hits)
        : pass();
    },
  },
  {
    id: 'AF-32',
    severity: 'WARN',
    title: 'Web project: browser support target in AGENTS.md',
    check(ctx) {
      const pages = ctx.files.filter((f) => /\.(html|css|scss|tsx|jsx|vue|svelte)$/.test(f) && !isTest(f));
      if (!pages.length) return pass();
      return BASELINE_TARGET.test(ctx.read('AGENTS.md') ?? '')
        ? pass()
        : fail("Add the browser support target to AGENTS.md: This project's Baseline target is Baseline Widely available.");
    },
  },
  {
    id: 'AF-33',
    severity: 'WARN',
    title: 'No request bodies, headers or whole environment in logs',
    check(ctx) {
      const hits = grep(
        ctx,
        serverCode(ctx),
        /(?:console\.(?:log|info|warn|error|debug)|\b(?:logger|fastify\.log|log)\.(?:log|info|warn|error|debug|trace)|\blogging\.(?:info|warning|error|debug|exception)|\bprint)\s*\([^;]*(?:\b(?:req|request|ctx)\.(?:body|headers|rawHeaders)\b|\bprocess\.env\b(?!\.))/,
      );
      return hits.length
        ? fail('Logging a request body, its headers or the whole environment can leak personal or secret data: log ids and outcomes, not payloads', hits)
        : pass();
    },
  },
];
