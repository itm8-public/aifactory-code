import { z } from 'zod';

// Every setting comes from an environment variable and is checked once at startup. The error
// names what is wrong, never a value. Unset APP_ENVIRONMENT means local development; in Azure
// the platform sets it (dev, test or prod) together with AZURE_CLIENT_ID and the PG* names.

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

/** An optional setting that may arrive as an empty string. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const csv = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

const platform = {
  APP_ENVIRONMENT: optional(z.enum(['dev', 'test', 'prod'])),
  AZURE_CLIENT_ID: optional(z.string()),
};

// @if db
const database = {
  PGHOST: z.string().min(1),
  PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
  PGDATABASE: z.string().min(1),
  PGUSER: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
};
// @endif

const appSchema = z
  .object({
    ...platform,
// @if db
    ...database,
// @endif
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    /** Public origin, e.g. https://app.example.com. Unset: compared with the forwarded host. */
    APP_PUBLIC_ORIGIN: optional(z.url({ protocol: /^https?$/ })),
    /** Local development only: a stand-in user instead of Easy Auth. */
    DEV_AUTH_BYPASS: bool,
    DEV_AUTH_ROLES: csv('App.Admin'),
// @if ai
    /** Foundry project endpoint (itm8's shared platform), without /openai/v1. */
    AZURE_AI_PROJECT_ENDPOINT: optional(z.url({ protocol: /^https$/ })),
    /** Foundry account or AI gateway endpoint (customer landing zones). Wins when both are set. */
    AZURE_OPENAI_ENDPOINT: optional(z.url({ protocol: /^https$/ })),
    /** Name of the chat model deployment. Optional locally: without it the AI answers "not configured". */
    AI_CHAT_DEPLOYMENT: optional(z.string().min(1)),
    AI_REQUESTS_PER_USER_PER_HOUR: z.coerce.number().int().min(1).max(10000).default(30),
    /** Token scope override, only when itm8 tells you the gateway expects another audience. */
    AI_TOKEN_SCOPE: optional(z.string()),
// @endif
  })
  .superRefine((c, ctx) => {
    if (c.DEV_AUTH_BYPASS && c.APP_ENVIRONMENT) {
      ctx.addIssue({
        code: 'custom',
        path: ['DEV_AUTH_BYPASS'],
        message: 'is for local development only and must be off when APP_ENVIRONMENT is set',
      });
    }
    if (c.APP_ENVIRONMENT && !c.AZURE_CLIENT_ID) {
      ctx.addIssue({ code: 'custom', path: ['AZURE_CLIENT_ID'], message: 'is required in Azure' });
    }
// @if ai
    if (c.APP_ENVIRONMENT && !c.AZURE_AI_PROJECT_ENDPOINT && !c.AZURE_OPENAI_ENDPOINT) {
      ctx.addIssue({
        code: 'custom',
        path: ['AZURE_AI_PROJECT_ENDPOINT'],
        message: 'or AZURE_OPENAI_ENDPOINT is required in Azure',
      });
    }
    if (c.APP_ENVIRONMENT && !c.AI_CHAT_DEPLOYMENT) {
      ctx.addIssue({ code: 'custom', path: ['AI_CHAT_DEPLOYMENT'], message: 'is required in Azure' });
    }
// @endif
  });

export type Config = z.infer<typeof appSchema>;

function parse<T extends z.ZodType>(schema: T, env: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(env);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `${i.path.join('.') || 'settings'}: ${i.message}`);
  throw new Error(`Invalid configuration:\n  ${lines.join('\n  ')}`);
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return parse(appSchema, env);
}
// @if db

const dbOnlySchema = z.object({ ...platform, ...database, DB_RUNTIME_ROLES: csv('') });
export type DbConfig = z.infer<typeof dbOnlySchema>;

/** The settings the migration job gets: the platform names, PG* and DB_RUNTIME_ROLES. */
export function loadDbConfig(env: Record<string, string | undefined> = process.env): DbConfig {
  return parse(dbOnlySchema, env);
}
// @endif
