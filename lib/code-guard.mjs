// Code that is wrong in an AI Factory app whatever the context, shared by the PreToolUse code
// guard and the build check (AF-09, AF-19, AF-31). Each entry names the safe way. Heuristics, not
// proof: a clean result never makes code safe; the change gate in GUARD.md does the thinking.

const JS = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const PY = /\.py$/;

/** Tests carry attack payloads and fixtures as data, so the unsafe-code shapes skip them. */
export const isTestFile = (f) => /(^|\/)(test|tests|__tests__)\//.test(f) || /\.(test|spec)\.[a-z]+$/.test(f) || /(^|\/)test_[^/]+\.py$/.test(f);

/** Infrastructure code: the Wizard generates it (AF-09). */
export const INFRA_FILE = /\.(bicep|bicepparam|tf|tfvars)$|(^|\/)azure\.yaml$/;

/** Deploy steps in a workflow (AF-09). */
export const DEPLOY_STEP =
  /azure\/login@|\baz\s+(deployment|containerapp\s+(create|update|up)|webapp\s+deploy|acr\s+build)\b|\bazd\s+(up|deploy|provision)\b|\bterraform\s+apply\b|AzureCLI@|AzureResourceManagerTemplateDeployment@/;

/** Direct calls to AI providers other than Azure AI Foundry (AF-19). */
export const DIRECT_AI =
  /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|api\.cohere\.(ai|com)|\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|GOOGLE_API_KEY|MISTRAL_API_KEY)\b/;

/** Unsafe code shapes (AF-31). `files` picks the language. */
export const UNSAFE_CODE = [
  {
    id: 'tls-off',
    files: JS,
    re: /\brejectUnauthorized\s*:\s*false\b|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"`]?0/,
    what: 'TLS certificate checks switched off',
    fix: 'Keep certificate checks on. PostgreSQL on Azure presents a trusted certificate; use the platform settings as they are.',
  },
  {
    id: 'tls-off',
    files: PY,
    re: /\bverify\s*=\s*False\b|_create_unverified_context\b|\bCERT_NONE\b|\bcheck_hostname\s*=\s*False\b/,
    what: 'TLS certificate checks switched off',
    fix: 'Keep certificate checks on. PostgreSQL on Azure presents a trusted certificate; use the platform settings as they are.',
  },
  {
    id: 'dynamic-code',
    files: JS,
    re: /(?<![\w$.])eval\s*\(|\bnew\s+Function\s*\(/,
    what: 'text run as code',
    fix: 'Parse data with JSON.parse and a zod schema. Never run text as code.',
  },
  {
    id: 'dynamic-code',
    files: PY,
    re: /(?<![\w.])(eval|exec)\s*\(|\bpickle\.loads?\s*\(|\byaml\.load\s*\((?![^)]*SafeLoader)/,
    what: 'text run as code, or an unsafe deserializer',
    fix: 'Parse data with json and a pydantic model (yaml.safe_load for YAML). Never run or unpickle text from outside.',
  },
  {
    id: 'shell-string',
    files: JS,
    re: /(?:^|[^\w$.]|child_process\.)(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|[^,()]*\+)|\bshell\s*:\s*true\b/,
    what: 'a shell command built from a string',
    fix: 'Call execFile or spawn with a fixed program and an argument array, without a shell. Better: no process at all.',
  },
  {
    id: 'shell-string',
    files: PY,
    re: /\bshell\s*=\s*True\b|\bos\.(system|popen)\s*\(/,
    what: 'a shell command built from a string',
    fix: 'Call subprocess.run with a fixed program and an argument list, without a shell. Better: no process at all.',
  },
  {
    id: 'sql-string',
    files: JS,
    re: /\.(?:query|execute|raw|unsafe)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)|\$(?:query|execute)RawUnsafe\s*\(/,
    what: 'SQL built from a string',
    fix: "Use the query builder or the sql`` tagged template, which sends values as parameters.",
  },
  {
    id: 'sql-string',
    files: PY,
    re: /\.execute(?:many)?\s*\(\s*(?:f["']|["'][^"']*["']\s*(?:%|\.format\s*\(|\+))|\btext\s*\(\s*f["']/,
    what: 'SQL built from a string',
    fix: 'Pass values as parameters (%s placeholders and a tuple), or compose names with psycopg.sql.',
  },
  {
    id: 'raw-html',
    files: JS,
    re: /\bdangerouslySetInnerHTML\b|\.(?:innerHTML|outerHTML)\s*=(?!=)|\binsertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(/,
    what: 'HTML built from a string',
    fix: 'Render text through React, which escapes it. Rich text is stored as Markdown and rendered without raw HTML.',
  },
  {
    id: 'raw-html',
    files: PY,
    re: /\bmark_safe\s*\(|\bMarkup\s*\(|HTMLResponse\s*\(\s*f["']/,
    what: 'HTML built from a string',
    fix: 'Let the template engine escape values, and keep static HTML in a file.',
  },
  {
    id: 'cors-any',
    files: JS,
    re: /\bcors\b[^\n]*\borigin\s*:\s*(?:['"]\*['"]|true\b)|Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]/,
    what: 'CORS open to every site',
    fix: 'The browser calls only web on the same origin, so the app needs no CORS at all.',
  },
  {
    id: 'cors-any',
    files: PY,
    re: /allow_origins\s*=\s*\[\s*["']\*["']/,
    what: 'CORS open to every site',
    fix: 'The browser calls only web on the same origin, so the app needs no CORS at all.',
  },
];

/** The first unsafe code shape in a file's text as { id, what, fix, line }, or null. Tests are skipped. */
export function findUnsafeCode(file, text) {
  const path = String(file).replace(/\\/g, '/');
  if (typeof text !== 'string' || !text || isTestFile(path)) return null;
  const shapes = UNSAFE_CODE.filter((s) => s.files.test(path));
  if (!shapes.length) return null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const shape = shapes.find((s) => s.re.test(lines[i]));
    if (shape) return { id: shape.id, what: shape.what, fix: shape.fix, line: i + 1 };
  }
  return null;
}
