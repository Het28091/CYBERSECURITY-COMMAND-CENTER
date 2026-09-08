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
  { pattern: /\brm\s+-rf\s+\/(\s|$)/,           reason: 'rm -rf /' },
  { pattern: /\brm\s+-rf\s+~/,                  reason: 'rm -rf ~' },
  { pattern: /\brm\s+-rf\s+\*/,                reason: 'rm -rf *' },
  { pattern: /\bdd\s+if=/,                     reason: 'dd if=' },
  { pattern: /\bmkfs\b/,                       reason: 'mkfs' },
  { pattern: />\s*\/dev\/(sd|nvme|hd)/,        reason: 'write to block device' },
  { pattern: /\bchmod\s+-R\s+777\s+\//,        reason: 'chmod -R 777 /' },
  { pattern: /\bchown\s+-R\s+\S+\s+\//,        reason: 'chown -R root /' },
  { pattern: /\bsudo\b/,                       reason: 'sudo' },
  { pattern: /\bsu\b/,                          reason: 'su' },
  { pattern: /\bdoas\b/,                        reason: 'doas' },
  { pattern: /\bnc\s+-l\b/,                    reason: 'nc -l (bind shell)' },
  { pattern: /\bnc\s+-e\b/,                    reason: 'nc -e (bind shell)' },
  { pattern: /\bbash\s+-i\b/,                  reason: 'bash -i (interactive shell)' },
  { pattern: /\bsh\s+-i\b/,                    reason: 'sh -i' },
  { pattern: /\bcurl\b[^|]*\|\s*(sh|bash)/,    reason: 'curl | sh' },
  { pattern: /\bwget\b[^|]*\|\s*(sh|bash)/,   reason: 'wget | sh' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\};\s*:/, reason: 'fork bomb' },
  { pattern: /\beval\b/,                       reason: 'eval' },
  { pattern: /\bexec\b\s+\$?[(<{]/,            reason: 'exec with command substitution' },
  { pattern: /`[^`]*`/,                        reason: 'backtick command substitution' },
  { pattern: /\$\([^)]*\)/,                    reason: '$(...) command substitution' },
  { pattern: /\bimport\s+os;\s*os\.system\b/,  reason: 'python os.system one-liner' },
  { pattern: /\bos\.system\s*\(/,              reason: 'python os.system()' },
  { pattern: /\bsubprocess\.call\s*\(\s*["']?\/bin\/(sh|bash)/, reason: 'python subprocess shell' },
  { pattern: /\boptname=install\b/,            reason: 'npm install from arbitrary package' },
];

/**
 * Validate the executable against the allow-list, then scan argv for any
 * blocked token. Returns ok=false with the first blocked token's reason.
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
