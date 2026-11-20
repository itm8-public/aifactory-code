import { buildApp, type BuildAppOptions } from '../app';
import { loadConfig, type Config } from '../config';
// @if db
import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
// @endif

/** Settings for tests: no bypass, quiet logs, the local test database. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    LOG_LEVEL: 'silent',
    DEV_AUTH_BYPASS: 'false',
// @if db
    PGHOST: process.env.PGHOST ?? 'localhost',
    PGPORT: process.env.PGPORT ?? '55432',
    PGDATABASE: process.env.PGDATABASE_TEST ?? 'app_test',
    PGUSER: process.env.PGUSER ?? 'postgres',
// @endif
    ...overrides,
  });
}

export async function testApp(overrides: Partial<BuildAppOptions> = {}) {
// @if spa
  const app = await buildApp({ config: testConfig(), logger: false, publicDir: null, ...overrides });
// @endif
// @if !spa
  const app = await buildApp({ config: testConfig(), logger: false, ...overrides });
// @endif
  await app.ready();
  return app;
}
// @if db

const TABLES = [
  'items',
  'audit_log',
// @if ai
  'ai_usage',
// @endif
// @if agent
  'agent_actions',
// @endif
];

/** Empties every table so each test starts from the same state. */
export async function resetDb(db: Db) {
  await db.execute(sql.raw(`truncate table ${TABLES.join(', ')} restart identity cascade`));
}
// @endif

const OBJECT_ID = 'http://schemas.microsoft.com/identity/claims/objectidentifier';

/** The header Easy Auth sends for a signed-in user. */
export function principal(id: string, roles: string[] = [], name = 'Test user', clientId?: string): string {
  const claims = [
    { typ: OBJECT_ID, val: id },
    { typ: 'name', val: name },
    ...roles.map((val) => ({ typ: 'roles', val })),
    ...(clientId ? [{ typ: 'azp', val: clientId }] : []),
  ];
  return Buffer.from(JSON.stringify({ auth_typ: 'aad', name_typ: 'name', role_typ: 'roles', claims })).toString(
    'base64',
  );
}

export const asUser = (id: string, roles: string[] = []) => ({ 'x-ms-client-principal': principal(id, roles) });
export const USER = '11111111-1111-4111-8111-111111111111';
export const ADMIN = '22222222-2222-4222-8222-222222222222';
