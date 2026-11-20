// Secret-shaped values, shared by the PreToolUse secret guard and the build check (AF-11).
// Patterns are built so this file itself does not match them. A match never echoes the value.

const PLACEHOLDER = /^[<{$%]|<[^>\s]*>|\$\{[^}]*\}|changeme|change-me|example|placeholder|xxxx|your[-_ ]/i;

export const SECRET_PATTERNS = [
  { rule: 'private key', re: new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----') },
  { rule: 'password in a connection string', re: /\b(?:Password|Pwd)\s*=\s*([^;'"\s]{4,})/i },
  { rule: 'storage account key', re: /\bAccountKey\s*=\s*([A-Za-z0-9+/=]{20,})/ },
  { rule: 'shared access key', re: /\bSharedAccessKey\s*=\s*([A-Za-z0-9+/=]{20,})/ },
  { rule: 'shared access signature', re: /[?&]sig=([A-Za-z0-9%+/=]{30,})/ },
  { rule: 'OpenAI-style API key', re: new RegExp('\\b(s' + 'k-(?:proj-|ant-)?[A-Za-z0-9_-]{20,})') },
  { rule: 'GitHub token', re: new RegExp('\\b((?:gh' + 'p|gh' + 'o|gh' + 's|gh' + 'u)_[A-Za-z0-9]{30,}|github' + '_pat_[A-Za-z0-9_]{30,})') },
  { rule: 'AWS access key', re: new RegExp('\\b(AK' + 'IA[0-9A-Z]{16})\\b') },
  { rule: 'Entra client secret', re: /\b([A-Za-z0-9_-]{3}8Q~[A-Za-z0-9_.~-]{31,34})\b/ },
  { rule: 'JSON web token', re: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/ },
  { rule: 'password in a URL', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"]+:([^\s@'"/]{3,})@/i },
  { rule: 'Slack token', re: new RegExp('\\b(xo' + 'x[abprs]-[A-Za-z0-9-]{10,})') },
];

/** Returns the first secret-shaped value in the text as { rule, line }, or null. */
export function findSecret(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { rule, re } of SECRET_PATTERNS) {
      const m = re.exec(line);
      if (!m) continue;
      const value = m[1] ?? m[0];
      if (PLACEHOLDER.test(value)) continue;
      return { rule, line: i + 1 };
    }
  }
  return null;
}

/** `.env`, `.env.local`, `.env.production` …, but not the committed examples. */
export function isDotEnvFile(path) {
  const name = String(path).split(/[\\/]/).pop() ?? '';
  if (!/^\.env(\..+)?$/.test(name)) return false;
  return !/\.(example|sample|template)$/.test(name);
}

/** Microsoft 365 Agents Toolkit keeps committed, secret-free env files in env/.env.<name>. */
export function isAgentsToolkitEnv(path) {
  const parts = String(path).split(/[\\/]/);
  const name = parts.pop() ?? '';
  return parts.pop() === 'env' && /^\.env\.[a-z0-9-]+$/i.test(name) && !/\.user$/.test(name);
}
