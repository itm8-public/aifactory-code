import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const base = {
// @if db
  PGHOST: 'localhost',
  PGDATABASE: 'app',
  PGUSER: 'postgres',
// @endif
};

describe('configuration', () => {
  it('defaults to port 8080 and no bypass', () => {
    const config = loadConfig(base);
    expect(config.PORT).toBe(8080);
    expect(config.DEV_AUTH_BYPASS).toBe(false);
  });

  it('refuses the dev bypass in Azure', () => {
    expect(() =>
      loadConfig({ ...base, APP_ENVIRONMENT: 'prod', AZURE_CLIENT_ID: 'id', DEV_AUTH_BYPASS: 'true' }),
    ).toThrow(/DEV_AUTH_BYPASS/);
  });

  it('needs the managed identity in Azure', () => {
    expect(() => loadConfig({ ...base, APP_ENVIRONMENT: 'dev' })).toThrow(/AZURE_CLIENT_ID/);
  });

  it('names a bad setting without echoing its value', () => {
    const secretLooking = 'not-a-port-1234567890';
    try {
      loadConfig({ ...base, PORT: secretLooking });
      expect.unreachable();
    } catch (err) {
      expect(String(err)).toMatch(/PORT/);
      expect(String(err)).not.toContain(secretLooking);
    }
  });
});
