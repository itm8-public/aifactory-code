import { describe, expect, it } from 'vitest';
import { decide, report, type Input } from './pr-verdict';

const passed = { lint: 'success', tests: 'success', 'dependency-audit': 'success' };
const input = (over: Partial<Input>): Input => ({
  files: ['src/server/routes/items.ts', 'src/web/pages/AuthorsPage.tsx'],
  checks: passed,
  ...over,
});
const reasonsFor = (files: string[]) => decide(input({ files })).reasons;

describe('pull request verdict', () => {
  it('says no-escalation for an ordinary change with passing checks', () => {
    const result = decide(input({}));
    expect(result).toEqual({ verdict: 'no-escalation', reasons: [] });
    expect(report(result)).toMatch(/^### Pull request verdict: no-escalation\n/);
  });

  it('needs a person for identity or access code', () => {
    for (const file of ['src/server/auth.ts', 'src/server/security.ts', 'src/server/lib/authorize.ts', 'src/server/roles.ts']) {
      expect(reasonsFor([file]), file).toEqual(['Touches identity or access code or configuration']);
    }
  });

  it('needs a person for a database migration', () => {
    for (const file of ['drizzle/0003_orders.sql', 'drizzle/meta/_journal.json', 'src/server/db/migrate.ts']) {
      expect(reasonsFor([file]), file).toEqual(['Touches a database migration']);
    }
  });

  it('needs a person for CI, deployment or infrastructure configuration, and for this script', () => {
    for (const file of ['.github/workflows/ci.yml', 'Dockerfile', 'infra/main.bicep', '.aifactory/build-profile.json', 'scripts/pr-verdict.ts']) {
      expect(reasonsFor([file]), file).toEqual(['Touches CI, deployment or infrastructure configuration']);
    }
  });

  it('needs a person for any changed dependency manifest or lock file', () => {
    for (const file of ['package.json', 'package-lock.json', 'copilot/package.json', 'uv.lock']) {
      expect(reasonsFor([file]), file).toEqual(['Changes a dependency manifest or lock file']);
    }
  });

  it('needs a person when a check failed or did not run', () => {
    const result = decide(input({ checks: { lint: 'failure', tests: 'skipped', build: '', 'dependency-audit': 'success' } }));
    expect(result.verdict).toBe('needs-a-person');
    expect(result.reasons).toEqual(['A check failed: lint', 'A check did not run: tests, build']);
  });

  it('needs a person when the changed files could not be read', () => {
    const result = decide(input({ files: null }));
    expect(result).toEqual({ verdict: 'needs-a-person', reasons: ['The changed files could not be read, so nothing is ruled out'] });
  });

  it('names each area once and never a file path', () => {
    const files = ['src/server/auth.ts', 'src/server/auth.test.ts', 'drizzle/0003_orders.sql', 'package.json'];
    const text = report(decide(input({ files })));
    expect(text).toContain(
      '- Touches identity or access code or configuration\n- Touches a database migration\n- Changes a dependency manifest or lock file\n',
    );
    for (const file of files) expect(text).not.toContain(file);
  });
});
