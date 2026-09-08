// Secret redaction module.
// Strips common secret patterns from log lines and API responses before they
// are persisted or sent to the client.

const PATTERNS: { re: RegExp; replacement: string; label: string }[] = [
  // AWS access key
  { re: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '[REDACTED:AWS_KEY]', label: 'AWS_KEY' },
  // AWS secret (40 char base64-ish after "aws_secret" or quoted assignment)
  { re: /\b(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/g, replacement: '[REDACTED:AWS_SECRET]', label: 'AWS_SECRET' },
  // Generic API key assignment
  { re: /\b(?:api[_-]?key|API[_-]?KEY)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?/g, replacement: '[REDACTED:API_KEY]', label: 'API_KEY' },
  // Generic secret assignment
  { re: /\b(?:secret|SECRET)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?/g, replacement: '[REDACTED:SECRET]', label: 'SECRET' },
  // Generic token assignment
  { re: /\b(?:token|TOKEN)\s*[=:]\s*['"]?[A-Za-z0-9_\-\.]{16,}['"]?/g, replacement: '[REDACTED:TOKEN]', label: 'TOKEN' },
  // Bearer tokens (Authorization: Bearer xxx)
  { re: /\bBearer\s+[A-Za-z0-9_\-\.=]{20,}/g, replacement: 'Bearer [REDACTED:BEARER]', label: 'BEARER' },
  // GitHub PAT
  { re: /\bghp_[A-Za-z0-9]{36,}\b/g, replacement: '[REDACTED:GITHUB_PAT]', label: 'GITHUB_PAT' },
  // GitHub fine-grained
  { re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, replacement: '[REDACTED:GITHUB_PAT]', label: 'GITHUB_PAT' },
  // Slack token
  { re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g, replacement: '[REDACTED:SLACK]', label: 'SLACK' },
  // Stripe
  { re: /\b(?:sk|pk)_(?:test_|live_)?[A-Za-z0-9]{20,}\b/g, replacement: '[REDACTED:STRIPE]', label: 'STRIPE' },
  // Private key blocks
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED:PRIVATE_KEY]', label: 'PRIVATE_KEY' },
  // JWT
  { re: /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g, replacement: '[REDACTED:JWT]', label: 'JWT' },
  // Generic password in URL: https://user:pass@host
  { re: /\bhttps?:\/\/[^:@\s]+:[^@\s]+@[^\s/]+/g, replacement: '[REDACTED:URL_BASIC_AUTH]', label: 'URL_BASIC_AUTH' },
  // Generic 32+ char hex string after key/secret-like words
  { re: /\b(secret|password|passwd|key|token|api[_-]?key)\b[^A-Za-z0-9]{0,5}[A-Fa-f0-9]{32,}\b/gi, replacement: '[REDACTED:HEX]', label: 'HEX' },
];

export function redact(input: string): string {
  if (!input) return input;
  let out = input;
  for (const p of PATTERNS) {
    out = out.replace(p.re, p.replacement);
  }
  return out;
}

export function redactObject<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      out[k] = redact(v);
    } else if (v && typeof v === 'object') {
      out[k] = redactObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

export function isSecretEnvVarName(name: string): boolean {
  const n = name.toLowerCase();
  return ['password', 'passwd', 'secret', 'api_key', 'apikey', 'token', 'private_key', 'access_key', 'client_secret'].some((s) => n.includes(s));
}
