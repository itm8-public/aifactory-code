import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { guard } from './helpers.mjs';
import { findSecret } from '../lib/secrets.mjs';

// Secret-shaped strings are built by concatenation so this file does not trip the guard itself.
const PEM = '-----BEGIN ' + 'PRIVATE KEY-----\nMIIEvQ...';
const CONN = 'Server=db.example;Pass' + 'word=Sup3rS3cretValue;';
const GH = 'gh' + 'p_' + 'a'.repeat(36);

const write = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });
const denied = (out) => out?.hookSpecificOutput?.permissionDecision === 'deny';

describe('secret guard', () => {
  it('denies writing .env files but not the examples', () => {
    assert.ok(denied(guard(write('/repo/.env', 'X=1'))));
    assert.ok(denied(guard(write('C:\\repo\\.env.local', 'X=1'))));
    assert.equal(guard(write('/repo/.env.example', 'PGHOST=localhost')), null);
    assert.equal(guard(write('/repo/.env.template', 'A=')), null);
  });

  it('allows Agents Toolkit env files without secrets, but scans them', () => {
    assert.equal(guard(write('/repo/env/.env.dev', 'TEAMSFX_ENV=dev')), null);
    assert.ok(denied(guard(write('/repo/env/.env.dev', `TOKEN=${GH}`))));
    assert.ok(denied(guard(write('/repo/env/.env.dev.user', 'A=1'))));
  });

  it('denies secret-shaped content in any file, without echoing it', () => {
    for (const secret of [PEM, CONN, GH]) {
      const out = guard(write('/repo/src/config.ts', `const x = \`${secret}\`;`));
      assert.ok(denied(out), secret.slice(0, 12));
      assert.ok(!out.hookSpecificOutput.permissionDecisionReason.includes(secret));
    }
  });

  it('checks Edit and MultiEdit text', () => {
    assert.ok(denied(guard({ tool_name: 'Edit', tool_input: { file_path: '/r/a.ts', new_string: CONN } })));
    assert.ok(
      denied(guard({ tool_name: 'MultiEdit', tool_input: { file_path: '/r/a.ts', edits: [{ new_string: 'ok' }, { new_string: PEM }] } })),
    );
  });

  it('allows placeholders, ordinary code and other tools', () => {
    assert.equal(guard(write('/r/README.md', 'Server=db;Pass' + 'word=<from Key Vault>;')), null);
    assert.equal(guard(write('/r/a.ts', 'password: () => accessToken(clientId)')), null);
    assert.equal(guard({ tool_name: 'Bash', tool_input: { command: 'echo hi' } }), null);
  });

  it('fails open on malformed input and can be switched off', () => {
    assert.equal(guard('not json'), null);
    assert.equal(guard(write('/repo/.env', 'X=1'), { AIFACTORY_SECRET_GUARD: 'off' }), null);
  });

  it('reports the line of the match', () => {
    assert.deepEqual(findSecret(`a\nb\n${CONN}`), { rule: 'password in a connection string', line: 3 });
  });
});
