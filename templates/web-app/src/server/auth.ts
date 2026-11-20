import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from './config';
import { forbidden, HttpError } from './errors';

// Easy Auth signs every user in before a request reaches the app and passes the user in the
// X-MS-CLIENT-PRINCIPAL header (base64 JSON). The app never sees a password or a token and has
// no login of its own. Users are keyed on their Entra object id, never on e-mail or name.
// The header can be trusted only because the app is reachable through Easy Auth alone.

export interface User {
  id: string;
  name: string;
  roles: string[];
  /** The calling client application (azp or appid claim) when the user came with a bearer token. */
  clientId?: string;
}

/**
 * The Microsoft Enterprise token store: Microsoft 365 Copilot calls an MCP server with tokens
 * issued to this client. Its tokens are accepted on /mcp only and refused everywhere else.
 */
export const COPILOT_TOKEN_STORE = 'ab3be6b7-f5df-413d-ac2d-abf1e3fd9c0b';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

const OBJECT_ID = 'http://schemas.microsoft.com/identity/claims/objectidentifier';

interface Principal {
  name_typ?: unknown;
  role_typ?: unknown;
  claims?: unknown;
}

export function parsePrincipal(header: unknown, idHeader?: unknown): User | null {
  if (typeof header !== 'string' || header.length === 0) return null;
  let principal: Principal;
  try {
    principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as Principal;
  } catch {
    return null;
  }
  const claims = Array.isArray(principal.claims)
    ? principal.claims.filter(
        (c): c is { typ: string; val: string } =>
          typeof c?.typ === 'string' && typeof c?.val === 'string',
      )
    : [];
  const get = (type: string) => claims.find((c) => c.typ === type)?.val;
  const roleType = typeof principal.role_typ === 'string' ? principal.role_typ : 'roles';
  const nameType = typeof principal.name_typ === 'string' ? principal.name_typ : 'name';
  const id = get(OBJECT_ID) ?? get('oid') ?? (typeof idHeader === 'string' ? idHeader : undefined);
  if (!id) return null;
  const clientId = get('azp') ?? get('appid');
  return {
    id,
    name: get('name') ?? get(nameType) ?? '',
    roles: [...new Set(claims.filter((c) => c.typ === roleType || c.typ === 'roles').map((c) => c.val))],
    ...(clientId ? { clientId } : {}),
  };
}

const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

const isMcp = (url: string) => /^\/mcp(\/|\?|$)/.test(url);

/** The paths that need a signed-in user: /api and the MCP endpoint. */
export const isProtected = (url: string) => url.startsWith('/api/') || isMcp(url);

/** Every /api route (and /mcp) needs a signed-in user. /healthz and the static front end do not. */
export function registerAuth(app: FastifyInstance, config: Config) {
  if (config.DEV_AUTH_BYPASS) {
    app.log.warn('DEV_AUTH_BYPASS is on: every API request acts as a local stand-in user');
  }
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    if (!isProtected(req.url)) return;
    const user =
      parsePrincipal(req.headers['x-ms-client-principal'], req.headers['x-ms-client-principal-id']) ??
      (config.DEV_AUTH_BYPASS
        ? { id: DEV_USER_ID, name: 'Local developer', roles: config.DEV_AUTH_ROLES }
        : null);
    if (!user) throw new HttpError(401, 'Your sign-in has expired. Reload the page.');
    if (user.clientId === COPILOT_TOKEN_STORE && !isMcp(req.url)) throw forbidden();
    req.user = user;
  });
}

/** The signed-in user; throws 401 outside /api routes. */
export function userOf(req: FastifyRequest): User {
  if (!req.user) throw new HttpError(401, 'Your sign-in has expired. Reload the page.');
  return req.user;
}

/** Checks an Entra app role on the server. Hiding a button is not a permission check. */
export function requireRole(req: FastifyRequest, role: string): User {
  const user = userOf(req);
  if (!user.roles.includes(role)) throw forbidden();
  return user;
}
