// Runs the assistant's evaluation set against the configured Foundry model and the local
// database: `npm run eval`. Needs the AI settings in .env and `az login` locally. Prints a score
// per case and exits 1 below the pass mark. Uses a synthetic evaluation user.
import { readFileSync } from 'node:fs';
import { buildApp } from '../src/server/app';
import { loadConfig } from '../src/server/config';
import { runAgent } from '../src/server/lib/agent';

interface Case {
  question: string;
  expectTools?: string[];
  forbidTools?: string[];
  mustInclude?: string[];
  expectProposal?: boolean;
  forbidProposalCount?: number;
  allowNoTool?: boolean;
}

const set = JSON.parse(readFileSync(new URL('../evals/agent.json', import.meta.url), 'utf8')) as {
  passMark: number;
  cases: Case[];
};
const user = { id: 'eval-user-00000000', name: 'Evaluation user', roles: [] as string[] };

const app = await buildApp({ config: loadConfig(), logger: false });
let passed = 0;
for (const c of set.cases) {
  const result = await runAgent(app, user, [{ role: 'user', content: c.question }]);
  const problems: string[] = [];
  if (result.status !== 'answered') {
    problems.push(`status ${result.status}`);
  } else {
    for (const t of c.expectTools ?? []) if (!result.toolsUsed.includes(t)) problems.push(`did not use ${t}`);
    for (const t of c.forbidTools ?? []) if (result.toolsUsed.includes(t)) problems.push(`used ${t}`);
    for (const w of c.mustInclude ?? []) if (!result.answer.toLowerCase().includes(w.toLowerCase())) problems.push(`answer lacks "${w}"`);
    if (c.expectProposal && result.proposals.length === 0) problems.push('no proposal');
    if (c.forbidProposalCount !== undefined && result.proposals.length >= c.forbidProposalCount) problems.push('too many proposals');
    if (!c.allowNoTool && !c.expectTools?.length && result.toolsUsed.length === 0) problems.push('used no tool');
  }
  if (problems.length === 0) passed++;
  console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${c.question}${problems.length ? `  (${problems.join('; ')})` : ''}`);
}
await app.close();
const score = passed / set.cases.length;
console.log(`\nScore ${passed}/${set.cases.length} (${Math.round(score * 100)} %), pass mark ${Math.round(set.passMark * 100)} %`);
process.exit(score >= set.passMark ? 0 : 1);
