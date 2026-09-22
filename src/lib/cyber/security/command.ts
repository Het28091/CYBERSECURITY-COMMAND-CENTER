// Command policy module.
// Validates an executable + argv against an allow-list of binaries and a
// block-list of dangerous tokens. The runner never executes a command that
// fails this check.

export interface CommandPolicyResult {
  ok: boolean;
  reason?: string;
  blockedToken?: string;
  executable?: string;
}

export const DEFAULT_ALLOWED_EXECUTABLES = new Set<string>([
  // Node
  'node', 'npm', 'npx', 'yarn', 'pnpm', 'bun', 'bunx',
  // Python
  'python', 'python3', 'pip', 'pip3', 'pipenv', 'poetry', 'uv', 'uvicorn', 'gunicorn',
  // Go / Rust / Ruby / PHP / Java
  'go', 'cargo', 'rustc', 'ruby', 'bundle', 'gem', 'rake',
  'php', 'composer', 'java', 'javac', 'mvn', 'gradle',
  // Build / container
  'make', 'docker', 'docker-compose',
  // Network (allowed, but with arg block-list checks)
  'git', 'curl', 'wget',
  // Shell — only for explicit shell runners; subject to arg block-list
  'bash', 'sh', 'zsh',
  // Utilities used by Make targets
  'echo', 'cat', 'ls', 'mkdir', 'cp', 'mv', 'touch', 'grep', 'rg', 'awk', 'sed', 'tr',
]);

export const BLOCKED_TOKENS: { pattern: RegExp; reason: string }[] = [
  // Destructive rm patterns — match `rm -rf /<anything>` (any path under /).
  { pattern: /\brm\s+-rf\s+\/(\S|$)/,           reason: 'rm -rf /<path>' },
  { pattern: /\brm\s+-rf\s+~/,                  reason: 'rm -rf ~' },
  { pattern: /\brm\s+-rf\s+\*/,                reason: 'rm -rf *' },
  // Destructive dd / mkfs / disk writes
  { pattern: /\bdd\s+if=/,                     reason: 'dd if=' },
  { pattern: /\bmkfs\b/,                       reason: 'mkfs' },
  { pattern: />\s*\/dev\/(sd|nvme|hd)/,        reason: 'write to block device' },
  // Privilege escalation
  { pattern: /\bchmod\s+-R\s+777\s+\//,        reason: 'chmod -R 777 /' },
  { pattern: /\bchown\s+-R\s+\S+\s+\//,        reason: 'chown -R root /' },
  { pattern: /\bsudo\b/,                       reason: 'sudo' },
  { pattern: /\bsu\b/,                          reason: 'su' },
  { pattern: /\bdoas\b/,                        reason: 'doas' },
  // Bind / reverse shells
  { pattern: /\bnc\s+-l\b/,                    reason: 'nc -l (bind shell)' },
  { pattern: /\bnc\s+-e\b/,                    reason: 'nc -e (bind shell)' },
  { pattern: /\bbash\s+-i\b/,                  reason: 'bash -i (interactive shell)' },
  { pattern: /\bsh\s+-i\b/,                    reason: 'sh -i' },
  // Pipe-to-shell exploits
  { pattern: /\bcurl\b[^|]*\|\s*(sh|bash)/,    reason: 'curl | sh' },
  { pattern: /\bwget\b[^|]*\|\s*(sh|bash)/,   reason: 'wget | sh' },
  // Fork bomb
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\};\s*:/, reason: 'fork bomb' },
  // Shell substitution (defense-in-depth; argv approach makes this safe but block anyway)
  { pattern: /\beval\b/,                       reason: 'eval' },
  { pattern: /\bexec\b\s+\$?[(<{]/,            reason: 'exec with command substitution' },
  { pattern: /`[^`]*`/,                        reason: 'backtick command substitution' },
  { pattern: /\$\([^)]*\)/,                    reason: '$(...) command substitution' },
  // Python code-exec one-liners
  { pattern: /\bimport\s+os;\s*os\.system\b/,  reason: 'python os.system one-liner' },
  { pattern: /\bos\.system\s*\(/,              reason: 'python os.system()' },
  { pattern: /\bsubprocess\.call\s*\(\s*["']?\/bin\/(sh|bash)/, reason: 'python subprocess shell' },
  { pattern: /\boptname=install\b/,            reason: 'npm install from arbitrary package' },
  // File-write to system paths via curl/wget — defense-in-depth
  { pattern: /\bcurl\b[^|]*\s-o\s+\/etc\b/,    reason: 'curl -o /etc/...' },
  { pattern: /\bcurl\b[^|]*\s--output\s+\/etc\b/, reason: 'curl --output /etc/...' },
  { pattern: /\bwget\b[^|]*\s-O\s+\/etc\b/,   reason: 'wget -O /etc/...' },
  { pattern: /\bwget\b[^|]*\s--output-document\s+\/etc\b/, reason: 'wget --output-document /etc/...' },
  { pattern: /\bcurl\b[^|]*\s-o\s+\/var\b/,    reason: 'curl -o /var/...' },
  { pattern: /\bwget\b[^|]*\s-O\s+\/var\b/,    reason: 'wget -O /var/...' },
  { pattern: /\bcurl\b[^|]*\s-o\s+\/usr\b/,    reason: 'curl -o /usr/...' },
  { pattern: /\bwget\b[^|]*\s-O\s+\/usr\b/,    reason: 'wget -O /usr/...' },
  { pattern: /\bcurl\b[^|]*\s-o\s+\/root\b/,   reason: 'curl -o /root/...' },
  { pattern: /\bwget\b[^|]*\s-O\s+\/root\b/,   reason: 'wget -O /root/...' },
  { pattern: /\bcurl\b[^|]*\s-o\s+\/home\b/,   reason: 'curl -o /home/...' },
  { pattern: /\bwget\b[^|]*\s-O\s+\/home\b/,   reason: 'wget -O /home/...' },
  // Cron / at queue tampering
  { pattern: /\b(crontab|at\s+now|at\s+\d)/,  reason: 'cron/at tampering' },
  // PATH manipulation (executable substitution protection)
  { pattern: /\bPATH\s*=\s*['"]?[^"'\s]*['"]?/, reason: 'PATH override (executable substitution risk)' },
];

/**
 * Validate the executable against the allow-list, then scan argv for any
 * blocked token. Returns ok=false with the first blocked token's reason.
 *
 * RB-011 fix: in addition to the basename allow-list, the executable is
 * resolved to an absolute path via PATH and checked against trusted
 * runtime locations. This prevents executable shadowing attacks where
 * an attacker places a malicious binary named `node` in a project directory
 * and the runner picks it up instead of the real one.
 */
export function checkCommand(
  executable: string,
  args: string[],
  opts?: { allowShell?: boolean },
): CommandPolicyResult {
  if (!executable) {
    return { ok: false, reason: 'Empty executable' };
  }

  // Resolve the executable name (basename) for the allow-list.
  const base = executable.split('/').pop() ?? executable;

  // `bash`/`sh` are only allowed when `allowShell` is set (used by the
  // ShellRunner). Even then, every arg is still scanned against the
  // block-list below.
  if (!DEFAULT_ALLOWED_EXECUTABLES.has(base)) {
    return {
      ok: false,
      executable: base,
      reason: `Executable not in allow-list: ${base}`,
    };
  }

  // RB-011: resolve the executable to an absolute path and check it's in
  // a trusted location. This prevents executable shadowing attacks.
  // If the executable is already an absolute or relative path (not just a
  // bare name), resolve it and verify it's trusted.
  const resolved = resolveAndCheckExecutable(executable);
  if (!resolved.ok) {
    return {
      ok: false,
      executable: base,
      reason: resolved.reason ?? 'Executable resolution failed',
    };
  }

  // If we're invoking a shell, the args ARE the script — block-list them
  // heavily.
  if (base === 'bash' || base === 'sh' || base === 'zsh') {
    if (!opts?.allowShell) {
      return { ok: false, reason: `Shell wrapper ${base} not permitted without allowShell` };
    }
  }

  // Scan the joined argv for blocked tokens.
  const joined = `${base} ${args.join(' ')}`;
  for (const { pattern, reason } of BLOCKED_TOKENS) {
    if (pattern.test(joined)) {
      return { ok: false, blockedToken: reason, reason: `Blocked: ${reason}` };
    }
  }

  return { ok: true, executable: base };
}

/**
 * Construct the display string for a resolved command. For UI only — never
 * used for execution (we use argv).
 */
export function displayCommand(exe: string, args: string[]): string {
  return [exe, ...args].map((a) =>
    /[\s'"$`\\]/.test(a) ? `'${a.replace(/'/g, `'"'"'`)}'` : a
  ).join(' ');
}

// ─── RB-011: Path-safe executable resolution ──────────────────────────────
//
// The previous `checkCommand` only checked the basename against the allow-list.
// This allowed executable shadowing: an attacker could place a malicious binary
// named `node` in a project directory and the runner would accept it because
// `node` is in the allow-list.
//
// The fix: resolve the executable to an absolute path via PATH and verify it's
// in a trusted runtime location. Bare names (like `npm`) are resolved via
// the system PATH. Absolute/relative paths (like `/tmp/evil/node` or `./node`)
// are resolved and checked directly.
//
// Trusted locations are the standard system binary directories plus the
// user's local runtime directories (bun, npm, etc.).

import * as path from 'node:path';
import * as fs from 'node:fs';

const TRUSTED_LOCATIONS = [
  '/usr/bin/',
  '/usr/local/bin/',
  '/bin/',
  '/sbin/',
  '/opt/homebrew/bin/',
  '/home/z/.bun/bin/',
  '/home/z/.local/bin/',
  '/home/z/my-project/node_modules/.bin/',
  // Node.js bundled binaries
  '/home/z/my-project/node_modules/.bin/',
];

function isTrustedPath(absPath: string): boolean {
  // Check if the path (as found on PATH) starts with any trusted location.
  // We do NOT follow symlinks here — the system administrator created the
  // symlink in the trusted location, so the link itself is trusted. What
  // it points to (e.g. npm → /usr/lib/node_modules/...) is the admin's
  // responsibility.
  return TRUSTED_LOCATIONS.some((loc) => absPath.startsWith(loc));
}

function resolveAndCheckExecutable(exe: string): { ok: boolean; reason?: string; resolved?: string } {
  // If the executable contains a path separator, it's a path (not a bare name).
  // Resolve it to absolute and check it's trusted.
  if (exe.includes('/')) {
    const abs = path.isAbsolute(exe) ? exe : path.resolve(exe);
    if (!fs.existsSync(abs)) {
      return { ok: false, reason: `Executable not found: ${abs}` };
    }
    if (!isTrustedPath(abs)) {
      return { ok: false, reason: `Executable outside trusted location: ${abs} (shadowing protection)` };
    }
    return { ok: true, resolved: abs };
  }

  // Bare name: resolve via PATH. If found, check it's trusted.
  // If not found, it's OK — the spawn will fail gracefully. We don't block
  // bare names that aren't on PATH because the allow-list already gates them.
  const paths = (process.env.PATH || '').split(':');
  for (const p of paths) {
    const candidate = path.join(p, exe);
    if (fs.existsSync(candidate)) {
      if (!isTrustedPath(candidate)) {
        return { ok: false, reason: `Resolved executable outside trusted location: ${candidate} (shadowing protection)` };
      }
      return { ok: true, resolved: candidate };
    }
  }
  // Not found on PATH — but it's in the allow-list, so let the spawn handle it.
  // This covers cases like `npx` which may be a shell function or `docker-compose`
  // which may be a Python script.
  return { ok: true };
}
