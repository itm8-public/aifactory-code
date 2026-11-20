import type { FastifyInstance, FastifyRequest } from 'fastify';
import { isProtected } from './auth';
import type { Config } from './config';
import { HttpError } from './errors';

// Security headers on every response, and a cross-site request guard: sign-in uses a cookie, so
// a request that changes data must come from the app's own origin.

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const HEADERS: Record<string, string> = {
  'content-security-policy': CSP,
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
};

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function allowedOrigins(req: FastifyRequest, config: Config): string[] {
  if (config.APP_PUBLIC_ORIGIN) return [new URL(config.APP_PUBLIC_ORIGIN).origin];
  // Behind the gateway and Easy Auth the public host arrives in X-Forwarded-Host.
  const forwarded = req.headers['x-forwarded-host'];
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.headers.host;
  return host ? [`https://${host}`, ...(config.APP_ENVIRONMENT ? [] : [`http://${host}`])] : [];
}

const isLocalOrigin = (origin: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

export function registerSecurity(app: FastifyInstance, config: Config) {
  app.addHook('onSend', async (req, reply) => {
    for (const [name, value] of Object.entries(HEADERS)) reply.header(name, value);
    reply.header('x-request-id', req.id);
  });

  app.addHook('onRequest', async (req) => {
    if (!UNSAFE.has(req.method) || !isProtected(req.url)) return;
    const origin = req.headers.origin;
    if (origin) {
      const local = !config.APP_ENVIRONMENT && isLocalOrigin(origin);
      if (!local && !allowedOrigins(req, config).includes(origin)) {
        throw new HttpError(403, 'This request came from another site.');
      }
      return;
    }
    // No Origin header: only JSON bodies, which a cross-site form cannot send.
    const type = req.headers['content-type'] ?? '';
    if (req.method !== 'DELETE' && !type.startsWith('application/json')) {
      throw new HttpError(415, 'Send JSON.');
    }
  });
}
