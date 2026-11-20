// CI, deployment and infrastructure configuration: files where a small edit changes what runs
// for everyone. The protected-files guard asks a person before Claude changes one that is already
// in the repository. Paths use forward slashes; a rule matches a repository-relative path and,
// as a first cheap test, an absolute one.
import { INFRA_FILE } from './code-guard.mjs';

export const PROTECTED_FILES = [
  { what: 'a CI workflow', re: /(^|\/)\.github\/workflows\/[^/]+/ },
  { what: 'a pipeline definition', re: /(^|\/)(azure-pipelines[^/]*\.ya?ml|\.gitlab-ci\.yml|bitbucket-pipelines\.yml)$/ },
  { what: 'infrastructure code', re: new RegExp(`(^|/)infra/|${INFRA_FILE.source}`) },
  { what: 'a container build file', re: /(^|\/)Dockerfile[^/]*$/ },
  {
    what: 'a code owners or branch protection file',
    re: /(^|\/)CODEOWNERS$|(^|\/)\.github\/(settings\.ya?ml$|rulesets\/)|(^|\/)[^/]*branch[-_]?protection[^/]*$/i,
  },
];

/** What kind of protected file the path is ("a CI workflow", …), or null. */
export function protectedKind(path) {
  const p = String(path).replace(/\\/g, '/');
  return PROTECTED_FILES.find((k) => k.re.test(p))?.what ?? null;
}
