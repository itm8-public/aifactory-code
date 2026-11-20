// Says whether a person has to look at a pull request: "needs-a-person" or "no-escalation",
// with the reasons. Deterministic: it reads the changed paths and the results of the checks that
// ran. No model is called. It names the areas touched, never file paths. It blocks nothing and is
// no review. CI runs it on every pull request (.github/workflows/ci.yml). Locally, on a branch:
//   node scripts/pr-verdict.ts origin/main lint=success
// Built-ins and erasable TypeScript only, so plain `node` (22.18 or later) runs it even when
// `npm ci` failed.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type Verdict = 'needs-a-person' | 'no-escalation';

export interface Input {
  /** Changed paths, relative to the repository, with forward slashes. Null: they could not be read. */
  files: string[] | null;
  /** Check name to its result: success, failure, cancelled, skipped, or empty when it never ran. */
  checks: Record<string, string>;
}

// Heuristics on paths. A wide net on purpose: a false alarm costs a look, a miss costs more.
const AREAS = [
  {
    reason: 'Touches identity or access code or configuration',
    re: /auth(?!or(?!i[sz]))|security|permission|rbac|identity|(^|[^a-z])(sso|roles?)([^a-z]|$)/i,
  },
  {
    reason: 'Touches a database migration',
    re: /(^|\/)(drizzle|migrations?)\/|(^|\/)migrate\.[a-z]+$|(^|\/)drizzle\.config\.[a-z]+$|\.sql$/i,
  },
  {
    // The last two: the design record the platform is built from, and this script itself.
    reason: 'Touches CI, deployment or infrastructure configuration',
    re: /^\.github\/|(^|\/)(azure-pipelines[^/]*\.ya?ml|\.gitlab-ci\.yml|bitbucket-pipelines\.yml)$|(^|\/)infra\/|\.(bicep|bicepparam|tf|tfvars)$|(^|\/)azure\.yaml$|(^|\/)Dockerfile[^/]*$|(^|\/)\.dockerignore$|(^|\/)docker-compose[^/]*\.ya?ml$|^docker\/|(^|\/)CODEOWNERS$|^\.aifactory\/build-profile\.json$|^scripts\/pr-verdict\./,
  },
  {
    // Any change: a new dependency, a major version and a changed lock all need a look.
    reason: 'Changes a dependency manifest or lock file',
    re: /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|pyproject\.toml|uv\.lock|poetry\.lock|requirements[^/]*\.txt)$/,
  },
];

function checkReasons(checks: Record<string, string>): string[] {
  const names = Object.keys(checks);
  const failed = names.filter((n) => checks[n] === 'failure');
  // Not run is not passed: a skipped or cancelled check rules nothing out.
  const notRun = names.filter((n) => checks[n] !== 'success' && checks[n] !== 'failure');
  return [
    ...(failed.length ? [`A check failed: ${failed.join(', ')}`] : []),
    ...(notRun.length ? [`A check did not run: ${notRun.join(', ')}`] : []),
  ];
}

export function decide(input: Input): { verdict: Verdict; reasons: string[] } {
  const { files } = input;
  const reasons =
    files === null
      ? ['The changed files could not be read, so nothing is ruled out']
      : AREAS.filter((area) => files.some((f) => area.re.test(f))).map((area) => area.reason);
  reasons.push(...checkReasons(input.checks));
  return { verdict: reasons.length ? 'needs-a-person' : 'no-escalation', reasons };
}

/** The verdict as Markdown, for the log and the job summary. */
export function report(result: { verdict: Verdict; reasons: string[] }): string {
  return [
    `### Pull request verdict: ${result.verdict}`,
    '',
    ...(result.reasons.length
      ? result.reasons.map((r) => `- ${r}`)
      : ['No rule asks for a person: no identity, migration, CI, deployment or dependency change, and every check passed.']),
    '',
    'Path and check rules only (`scripts/pr-verdict.ts`). It blocks nothing and is no review.',
  ].join('\n');
}

/** Arguments: the base ref (default HEAD^1, the base of a pull request's merge commit), then name=result pairs. */
function main(argv: string[]): void {
  const base = argv.find((a) => !a.includes('=')) ?? 'HEAD^1';
  const checks = Object.fromEntries(
    argv.filter((a) => a.includes('=')).map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]),
  );
  const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let files: string[] | null = null;
  try {
    const from = git(['merge-base', base, 'HEAD']).trim();
    files = git(['diff', '--name-only', '--no-renames', '-z', from, 'HEAD']).split('\0').filter(Boolean);
  } catch (err) {
    console.error(`pr-verdict: ${err instanceof Error ? err.message.split('\n')[0] : 'git failed'}`);
  }
  const result = decide({ files, checks });
  const text = report(result);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${result.verdict}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
