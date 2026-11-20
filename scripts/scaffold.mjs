#!/usr/bin/env node
// Creates a new AI Factory project from the plugin's templates: only the parts the design
// interview chose. Deterministic, no network, no dependencies. Usage: see --help.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|svg)$/i;
const MARKER = /^\s*(?:\/\/|#|<!--|\{\/\*)\s*@(if|endif)\b\s*(!?[a-z]+)?/;
const INLINE = /<!-- @if (!?[a-z]+) -->(.*?)<!-- @endif -->/g;
const APP_NAME = /^[a-z][a-z0-9-]{0,9}$/;

/** The solution kinds: which template, and what each implies. */
export const KINDS = {
  web: { template: 'web-app', label: 'web app', language: 'typescript' },
  mcp: { template: 'web-app', label: 'MCP server', language: 'typescript' },
  agent: { template: 'agent-python', label: 'AI agent (Python, Microsoft Agent Framework)', language: 'python' },
  copilot: { template: 'copilot-agent', label: 'Microsoft 365 Copilot agent', language: null },
};

const HELP = `Usage: node scripts/scaffold.mjs --dest <folder> [options]

  --dest <folder>           Empty or new folder for the project (required)
  --title "<title>"         Solution title, sentence case (required)
  --kind <k>                web | mcp | agent (default: web)
                              web    one container: React front end and /api (TypeScript)
                              mcp    one container: an MCP server for Copilot and agents (TypeScript)
                              agent  one container: a Python Microsoft Agent Framework agent
                                     with a chat page; always has PostgreSQL and AI
                              copilot  no container: a Microsoft 365 Copilot agent for an existing
                                     MCP server (needs --mcp-url)
  --name <app>              App name: lowercase, digits, hyphens, max 10 chars (default: web)
  --target <t>              customer-lz | lz-online (required)
  --users <u>               internal | external (default: internal)
  --personal-data <p>       no | unknown (default: no; "yes" means stop and ask itm8 first)
  --consent <c>             recorded | not-needed | missing (AI build tools on customer code)
  --db                      Add PostgreSQL (web, mcp)
  --ai                      Add AI calls to Azure AI Foundry (web; needs --db)
  --agent                   Add an agent with tools and human approval (web; needs --ai)
  --mcp                     Add an /mcp endpoint for the app's data (web; needs --db)
  --copilot                 Add a Microsoft 365 Copilot agent that calls /mcp (web with --mcp, or mcp)
  --mcp-url <https url>     The MCP endpoint a --kind copilot agent calls
  --ask-itm8 "<a>;<b>"      Open "ask itm8" items to record in the build profile
  --json                    Print the result as JSON`;

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function pluginInfo() {
  const plugin = readJson(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'));
  const pin = readJson(join(PLUGIN_ROOT, 'rules', 'pin.json'));
  return { version: plugin.version, kitVersion: pin.kitVersion, kitCommit: pin.source.commit };
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`);
}

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

const isOn = (flags, cond) => (cond.startsWith('!') ? !flags[cond.slice(1)] : Boolean(flags[cond]));

/** Keeps or drops `@if flag` / `@if !flag` blocks (nestable) and inline HTML-comment blocks. */
export function applyConditions(text, flags) {
  const inline = text.replace(INLINE, (_, cond, body) => (isOn(flags, cond) ? body : ''));
  const stack = [];
  const out = [];
  for (const line of inline.split('\n')) {
    const m = MARKER.exec(line);
    if (m && m[1] === 'if') {
      if (!m[2]) throw new Error(`@if without a condition: ${line.trim()}`);
      stack.push(isOn(flags, m[2]));
      continue;
    }
    if (m && m[1] === 'endif') {
      if (!stack.length) throw new Error('@endif without @if');
      stack.pop();
      continue;
    }
    if (stack.every(Boolean)) out.push(line);
  }
  if (stack.length) throw new Error('@if without @endif');
  return out.join('\n');
}

/** The template flags for a set of options. */
export function flagsOf(o) {
  if (o.kind === 'agent') return { spa: false, db: true, ai: true, agent: true, mcp: false, copilot: false, python: true };
  if (o.kind === 'copilot') return { spa: false, db: false, ai: false, agent: false, mcp: false, copilot: true, standalone: true };
  if (o.kind === 'mcp') return { spa: false, db: Boolean(o.db), ai: false, agent: false, mcp: true, copilot: Boolean(o.copilot) };
  return {
    spa: true,
    db: Boolean(o.db),
    ai: Boolean(o.ai),
    agent: Boolean(o.agent),
    mcp: Boolean(o.mcp),
    copilot: Boolean(o.copilot),
  };
}

/** Which committed npm lock file matches the dependencies these flags bring in. */
export function lockSignature(flags) {
  return [flags.spa ? 'spa' : 'api', flags.db ? 'db' : '', flags.mcp ? 'mcp' : ''].filter(Boolean).join('-');
}

function slug(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'app'
  );
}

function thisProjectBlock(o, flags, info, date) {
  const yesNo = (v) => (v ? 'yes' : 'no');
  const hosting =
    o.target === 'customer-lz'
      ? "a customer's workload landing zone (itm8's Wizard builds it)"
      : "itm8's shared platform (ai.itm8.cloud)";
  const consent = {
    recorded: 'the customer has recorded consent',
    'not-needed': 'not needed (itm8-owned code and data)',
    missing: 'MISSING: synthetic data and itm8-owned code only until the customer consents',
  }[o.consent];
  const personal =
    o.personalData === 'no' ? 'no' : 'not yet known: synthetic data only until itm8 confirms the zone';
  const extras = [
    flags.agent && 'an agent with tools (actions need human approval)',
    flags.mcp && 'an MCP endpoint',
    flags.copilot && 'a Microsoft 365 Copilot agent in copilot/',
  ]
    .filter(Boolean)
    .join(', ');
  const apps =
    o.kind === 'copilot'
      ? `none: a Microsoft 365 Copilot agent that calls the MCP server at ${o.mcpUrl}; it runs in Microsoft 365, not in a landing zone`
      : `\`web\` only (app name \`${o.name}\`), a ${KINDS[o.kind].label}${extras ? ` with ${extras}` : ''}`;
  const ai = o.kind === 'copilot' ? 'Microsoft 365 Copilot (each user\'s licence)' : `Azure AI Foundry, ${yesNo(flags.ai)}`;
  return [
    '## This project',
    '',
    `Filled in by aifactory-code ${info.version} on ${date} from the design interview. Your itm8`,
    'contact confirms it.',
    '',
    '- Zone: **not confirmed, so build to Yellow** (Green, Yellow or Red; a person at itm8 confirms it)',
    '- Service level: basic (basic, standard or premium)',
    `- Users: ${o.users === 'external' ? 'also people outside the organisation (guests in the Entra tenant)' : 'internal only'}`,
    `- Apps: ${apps}`,
    `- Database: PostgreSQL, ${yesNo(flags.db)}`,
    `- AI: ${ai}`,
    `- Hosting: ${hosting}`,
    `- Personal data: ${personal}`,
    `- AI build tools on customer code: ${consent}`,
    // Projects with pages state which browser features need no fallback (build check AF-32).
    ...(flags.spa || flags.python ? ["- Browser support: This project's Baseline target is Baseline Widely available."] : []),
    '- itm8 contact: (name)',
    '',
  ].join('\n');
}

export function fillAgents(rules, block, info) {
  const lines = rules.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## This project');
  if (start < 0) throw new Error('The pinned rules have no "## This project" section');
  let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  if (end < 0) end = lines.length;
  const header = `<!-- aifactory-code ${info.version} · build-kit ${info.kitVersion} @ ${info.kitCommit.slice(0, 7)} -->`;
  return [header, ...lines.slice(0, start), ...block.split('\n'), ...lines.slice(end)].join('\n');
}

function settingsOf(flags) {
  const s = [
    { name: 'LOG_LEVEL', secret: false },
    { name: 'APP_PUBLIC_ORIGIN', secret: false },
  ];
  if (flags.ai) s.push({ name: 'AI_CHAT_DEPLOYMENT', secret: false }, { name: 'AI_REQUESTS_PER_USER_PER_HOUR', secret: false });
  return s;
}

export function buildProfile(o, flags, info, date) {
  return {
    schemaVersion: '1',
    generator: { name: 'aifactory-code', version: info.version },
    kit: { version: info.kitVersion, commit: info.kitCommit },
    createdAt: date,
    solution: { title: o.title, kind: o.kind },
    target: o.target,
    zone: { assumption: 'yellow', confirmed: false },
    serviceLevel: 'basic',
    users: o.users,
    personalData: o.personalData,
    aiToolConsent: o.consent,
    apps:
      o.kind === 'copilot'
        ? []
        : [
            {
              name: o.name,
              kind: 'web',
              language: KINDS[o.kind].language,
              port: 8080,
              healthPath: '/healthz',
              easyAuth: true,
              database: flags.db,
              ai: flags.ai,
              migrationCommand: flags.db ? (flags.python ? ['python', '-m', 'app.migrate'] : ['node', 'dist/migrate.js']) : null,
              settings: settingsOf(flags),
            },
          ],
    addons: { database: flags.db, ai: flags.ai, agent: flags.agent, mcp: flags.mcp, copilot: flags.copilot },
    ...(flags.copilot
      ? { copilot: { package: o.kind === 'copilot' ? 'appPackage' : 'copilot/appPackage', mcpUrl: o.mcpUrl ?? null, toolDiscovery: 'pinned' } }
      : {}),
    askItm8: o.askItm8.map((item) => ({ item, askedWho: null, answer: null })),
    // Derived from specs/ by scripts/feature.mjs sync.
    features: [],
  };
}

export function validate(o) {
  const errors = [];
  if (!o.dest) errors.push('--dest is required');
  if (!o.title || o.title.length > 80 || /__/.test(o.title)) errors.push('--title is required (at most 80 characters)');
  if (!KINDS[o.kind]) errors.push('--kind must be web, mcp, agent or copilot');
  if (!APP_NAME.test(o.name)) errors.push('--name must be lowercase letters, digits and hyphens, at most 10 characters, starting with a letter');
  if (!['customer-lz', 'lz-online'].includes(o.target)) errors.push('--target must be customer-lz or lz-online');
  if (!['internal', 'external'].includes(o.users)) errors.push('--users must be internal or external');
  if (o.personalData === 'yes') errors.push('Personal data means the Red zone: stop and ask itm8 before scaffolding. Use --personal-data unknown to build with synthetic data meanwhile.');
  else if (!['no', 'unknown'].includes(o.personalData)) errors.push('--personal-data must be no or unknown');
  if (!['recorded', 'not-needed', 'missing'].includes(o.consent)) errors.push('--consent must be recorded, not-needed or missing');
  if (o.kind === 'web') {
    if (o.ai && !o.db) errors.push('--ai needs --db: the per-user AI limit is kept in PostgreSQL');
    if (o.agent && !o.ai) errors.push('--agent needs --ai (and so --db): proposed actions wait in PostgreSQL for approval');
    if (o.mcp && !o.db) errors.push('--mcp needs --db: the endpoint exposes the app\'s data');
  }
  if (o.kind === 'web' && o.copilot && !o.mcp) errors.push('--copilot needs --mcp: the Copilot agent calls the app\'s MCP endpoint');
  if (o.kind === 'mcp' && (o.ai || o.agent || o.mcp)) errors.push('--kind mcp takes only --db and --copilot; it is an MCP server already and has no AI of its own');
  if (o.kind === 'agent' && (o.db || o.ai || o.agent || o.mcp || o.copilot)) errors.push('--kind agent always has PostgreSQL and AI; leave out --db, --ai, --agent, --mcp and --copilot');
  if (o.kind === 'copilot') {
    if (o.db || o.ai || o.agent || o.mcp || o.copilot) errors.push('--kind copilot takes no add-ons; it calls an existing MCP server');
    if (!/^https:\/\/[^\s/]+(\/\S*)?$/.test(o.mcpUrl ?? '')) errors.push('--kind copilot needs --mcp-url with the https URL of the MCP endpoint');
  } else if (o.mcpUrl) {
    errors.push('--mcp-url is only for --kind copilot');
  }
  if (o.dest && existsSync(o.dest) && readdirSync(o.dest).length > 0) errors.push(`${o.dest} is not empty`);
  return errors;
}

export function scaffold(options) {
  const o = {
    kind: 'web',
    name: 'web',
    users: 'internal',
    personalData: 'no',
    consent: options.target === 'lz-online' ? 'not-needed' : undefined,
    db: false,
    ai: false,
    agent: false,
    mcp: false,
    askItm8: [],
    ...options,
  };
  const errors = validate(o);
  if (errors.length) throw Object.assign(new Error(errors.join('\n')), { errors });

  const info = pluginInfo();
  const date = o.date ?? new Date().toISOString().slice(0, 10);
  const flags = flagsOf(o);
  const templateDir = join(PLUGIN_ROOT, 'templates', KINDS[o.kind].template);
  const manifest = readJson(join(templateDir, 'template.json'));
  const mcpUrl = o.kind === 'copilot' ? o.mcpUrl : 'https://app.example.com/mcp';
  const tokens = {
    __APP__: o.name,
    __TITLE__: o.title,
    __PLUGIN_VERSION__: info.version,
    __KIT_VERSION__: info.kitVersion,
    // Copilot package: name_for_human allows 20 characters, namespace letters and digits only.
    __SHORT_NAME__: o.title.slice(0, 20).trim(),
    __NAMESPACE__: slug(o.title).replace(/-/g, '').slice(0, 30) || 'app',
    __MCP_URL__: mcpUrl,
    __APP_PUBLIC_URL__: new URL(mcpUrl).origin,
    'aifactory-app-template': slug(o.title),
  };
  const written = [];

  const write = (rel, content) => {
    const target = join(o.dest, ...rel.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    if (Buffer.isBuffer(content)) writeFileSync(target, content);
    else writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`);
    written.push(rel);
  };
  const replaceTokens = (text) =>
    Object.entries(tokens).reduce((acc, [token, value]) => acc.split(token).join(value), text);

  /** Copies one template folder to `prefix` in the project, with conditions and tokens applied. */
  function render(dir, tmpl, renderFlags, prefix = '') {
    const skip = tmpl.skip.map(globToRegExp);
    const only = Object.entries(tmpl.only ?? {}).map(([cond, globs]) => [cond, globs.map(globToRegExp)]);
    for (const rel of walk(dir)) {
      if (skip.some((re) => re.test(rel))) continue;
      const needs = only.filter(([, res]) => res.some((re) => re.test(rel))).map(([cond]) => cond);
      if (needs.some((cond) => !isOn(renderFlags, cond))) continue;
      const outRel = prefix + (tmpl.rename?.[rel] ?? rel);
      const source = join(dir, ...rel.split('/'));
      if (BINARY.test(rel)) {
        write(outRel, readFileSync(source));
        continue;
      }
      const text = replaceTokens(applyConditions(readFileSync(source, 'utf8'), renderFlags));
      const leftover = /__[A-Z][A-Z_]*__/.exec(text);
      if (leftover) throw new Error(`Unreplaced token ${leftover[0]} in ${rel}`);
      write(outRel, text);
    }
  }

  mkdirSync(o.dest, { recursive: true });
  render(templateDir, manifest, flags);

  // A Copilot agent next to the app's own MCP endpoint lives in copilot/.
  if (flags.copilot && o.kind !== 'copilot') {
    const copilotDir = join(PLUGIN_ROOT, 'templates', 'copilot-agent');
    render(copilotDir, readJson(join(copilotDir, 'template.json')), { addon: true, db: flags.db }, 'copilot/');
  }

  // The design kit has a single source in the itm8-design skill.
  if (manifest.designKit && (manifest.designKit.when === undefined || isOn(flags, manifest.designKit.when))) {
    const kitDir = join(PLUGIN_ROOT, 'skills', 'itm8-design', 'kit');
    const include = (manifest.designKit.include ?? ['**']).map(globToRegExp);
    for (const rel of walk(kitDir).filter((f) => include.some((re) => re.test(f)))) {
      write(`${manifest.designKit.dest}/${rel}`, readFileSync(join(kitDir, ...rel.split('/'))));
    }
  }

  if (manifest.locks) {
    const lockFile = manifest.locks[lockSignature(flags)];
    if (!lockFile) throw new Error(`No npm lock file for ${lockSignature(flags)}`);
    write('package-lock.json', replaceTokens(readFileSync(join(templateDir, ...lockFile.split('/')), 'utf8')));
  }

  // Feature specs (the feature-specs skill) start empty in every kind.
  write('specs/README.md', readFileSync(join(PLUGIN_ROOT, 'templates', 'specs', 'README.md'), 'utf8'));

  const rules = readFileSync(join(PLUGIN_ROOT, 'rules', 'build-kit', 'AGENTS.md'), 'utf8');
  const profile = buildProfile(o, flags, info, date);
  write('AGENTS.md', fillAgents(rules, thisProjectBlock(o, flags, info, date), info));
  // AGENTS.md points to these two by name; they are copied unchanged so the pin hash still holds.
  for (const name of ['PERFORMANCE.md', 'GUARD.md']) write(name, readFileSync(join(PLUGIN_ROOT, 'rules', 'build-kit', name)));
  write('.aifactory/build-profile.json', `${JSON.stringify(profile, null, 2)}\n`);

  return { dest: resolve(o.dest), files: written.sort(), profile };
}

function parseArgs(argv) {
  const o = { askItm8: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} needs a value`);
      return v;
    };
    switch (arg) {
      case '--dest': o.dest = value(); break;
      case '--title': o.title = value().trim(); break;
      case '--kind': o.kind = value(); break;
      case '--name': o.name = value(); break;
      case '--target': o.target = value(); break;
      case '--users': o.users = value(); break;
      case '--personal-data': o.personalData = value(); break;
      case '--consent': o.consent = value(); break;
      case '--db': o.db = true; break;
      case '--ai': o.ai = true; break;
      case '--agent': o.agent = true; break;
      case '--mcp': o.mcp = true; break;
      case '--copilot': o.copilot = true; break;
      case '--mcp-url': o.mcpUrl = value(); break;
      case '--ask-itm8': o.askItm8 = value().split(';').map((s) => s.trim()).filter(Boolean); break;
      case '--json': o.json = true; break;
      case '--help': case '-h': o.help = true; break;
      default: throw new Error(`Unknown option ${arg}`);
    }
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.help) {
      console.log(HELP);
      process.exit(0);
    }
    const { json, ...options } = o;
    const result = scaffold(options);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const p = result.profile;
      const a = p.addons;
      const parts = [a.database && 'PostgreSQL', a.ai && 'AI', a.agent && 'agent with approval', a.mcp && 'MCP', a.copilot && 'Copilot agent'].filter(Boolean);
      console.log(`Created ${result.dest} (${result.files.length} files)`);
      if (p.apps.length) {
        console.log(`  ${KINDS[p.solution.kind].label} \`${p.apps[0].name}\`: port 8080, /healthz${parts.length ? `, ${parts.join(', ')}` : ''}`);
      } else {
        console.log(`  ${KINDS[p.solution.kind].label} calling ${p.copilot.mcpUrl} (pin its tools: see README.md)`);
      }
      console.log(`  target ${p.target}, zone: build to Yellow until itm8 confirms`);
      if (p.aiToolConsent === 'missing') console.log('  NOTE: no customer consent for AI build tools: synthetic data and itm8-owned code only');
      if (p.personalData === 'unknown') console.log('  NOTE: personal data unknown: synthetic data only until itm8 confirms the zone');
      console.log('Next: see README.md ("Run it locally"), then run the build check.');
    }
  } catch (err) {
    console.error(err.message);
    console.error('Run with --help for the options.');
    process.exit(1);
  }
}
