import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { TokenCredential } from '@azure/identity';
import type { DbConfig } from '../config';
import * as schema from './schema';

// In Azure the database password is an Entra access token for the app's managed identity,
// fetched for each new connection: no password exists anywhere. Locally (no APP_ENVIRONMENT)
// the app connects to the docker compose PostgreSQL, which trusts local connections.

const PG_SCOPE = 'https://ossrdbms-aad.database.windows.net/.default';
/** Entra tokens live about an hour; recycle connections well before that. */
const MAX_LIFETIME_SECONDS = 30 * 60;

// One credential per process: it caches tokens, so a new one per connection would be slow.
let credential: TokenCredential | undefined;
async function accessToken(clientId: string | undefined): Promise<string> {
  if (!credential) {
    const { DefaultAzureCredential, ManagedIdentityCredential } = await import('@azure/identity');
    credential = clientId ? new ManagedIdentityCredential({ clientId }) : new DefaultAzureCredential();
  }
  const token = await credential.getToken(PG_SCOPE);
  if (!token) throw new Error('Could not get an Entra token for PostgreSQL');
  return token.token;
}

type Settings = Pick<
  DbConfig,
  'APP_ENVIRONMENT' | 'AZURE_CLIENT_ID' | 'PGHOST' | 'PGPORT' | 'PGDATABASE' | 'PGUSER' | 'DB_POOL_MAX'
>;

export function createDb(s: Settings) {
  const azure = Boolean(s.APP_ENVIRONMENT);
  const sql = postgres({
    host: s.PGHOST,
    port: s.PGPORT,
    database: s.PGDATABASE,
    username: s.PGUSER,
    max: s.DB_POOL_MAX,
    connect_timeout: 10,
    onnotice: () => {},
    ...(azure
      ? {
          ssl: 'verify-full' as const,
          max_lifetime: MAX_LIFETIME_SECONDS,
          password: () => accessToken(s.AZURE_CLIENT_ID),
        }
      : { ssl: false as const }),
  });
  const db = drizzle(sql, { schema, casing: 'snake_case' });
  return { db, sql };
}

export type Db = ReturnType<typeof createDb>['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;
