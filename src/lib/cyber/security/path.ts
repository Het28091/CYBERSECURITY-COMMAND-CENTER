// Path safety module.
// All filesystem paths entering the system must pass through this module
// before being used by the discovery engine or the runner.

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PathCheckResult {
  ok: boolean;
  canonical: string | null;
  real: string | null;
  reason?: string;
  symlink: boolean;
  exists: boolean;
  isDirectory: boolean;
  insideAllowedRoot: boolean;
}

export interface AllowedRootsConfig {
  roots: string[]; // absolute, canonical
}

/**
 * Resolve and verify a project path against an allow-list of roots.
 *
 * - Rejects paths with `..` segments before resolution.
 * - Resolves to canonical absolute path.
 * - Detects symlinks and follows them to the real target.
 * - Re-checks the real target against allowed roots (prevents symlink escape).
 */
export function checkPath(
  rawInput: string,
  config: AllowedRootsConfig,
): PathCheckResult {
  const result: PathCheckResult = {
    ok: false,
    canonical: null,
    real: null,
    symlink: false,
    exists: false,
    isDirectory: false,
    insideAllowedRoot: false,
  };

  if (!rawInput || typeof rawInput !== 'string') {
    result.reason = 'Empty path';
    return result;
  }

  // Reject obvious traversal attempts before touching the FS.
  if (rawInput.includes('..')) {
    result.reason = 'Path contains ".." segments — rejected before resolution';
    return result;
  }

  // Resolve to absolute path. We do NOT use realpath yet because we want to
  // detect symlinks explicitly.
  const abs = path.isAbsolute(rawInput) ? rawInput : path.resolve(rawInput);
  let exists = false;
  let isDir = false;
  let isSymlink = false;
  try {
    const stat = fs.lstatSync(abs);
    exists = true;
    isSymlink = stat.isSymbolicLink();
    if (stat.isDirectory()) isDir = true;
  } catch {
    result.reason = `Path does not exist: ${abs}`;
    result.canonical = abs;
    return result;
  }

  // Canonicalise via realpath. This resolves symlinks.
  let real: string;
  try {
    real = fs.realpathSync(abs);
  } catch (e) {
    result.reason = `Realpath failed: ${(e as Error).message}`;
    result.canonical = abs;
    return result;
  }

  // Re-check the real target.
  try {
    const realStat = fs.statSync(real);
    if (!realStat.isDirectory()) {
      result.reason = `Real target is not a directory: ${real}`;
      result.canonical = abs;
      result.real = real;
      return result;
    }
  } catch (e) {
    result.reason = `Real target stat failed: ${(e as Error).message}`;
    result.canonical = abs;
    result.real = real;
    return result;
  }

  // Allowed root check (real path must be under one of the roots).
  const inside = config.roots.some((r) => {
    const rReal = fs.existsSync(r) ? safeRealpath(r) : r;
    return real === rReal || real.startsWith(rReal + path.sep);
  });

  if (!inside) {
    result.reason = `Real path outside allowed roots: ${real}`;
    result.canonical = abs;
    result.real = real;
    result.exists = exists;
    result.isDirectory = isDir;
    result.symlink = isSymlink;
    result.insideAllowedRoot = false;
    return result;
  }

  result.ok = true;
  result.canonical = abs;
  result.real = real;
  result.exists = exists;
  result.isDirectory = isDir;
  result.symlink = isSymlink;
  result.insideAllowedRoot = true;
  return result;
}

function safeRealpath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * Get the configured allowed roots from the database. Returns a default
 * sandbox-friendly list when no settings row exists yet.
 */
export function defaultAllowedRoots(): string[] {
  // Default to the user's project sandbox + upload directory.
  // (The user can broaden this in Settings.)
  return [
    process.cwd(),
    '/tmp',
  ];
}

/**
 * Read a file safely within a project root. Returns null if the path escapes
 * the project root (path-traversal / symlink-escape protection).
 */
export function safeReadFile(
  projectRoot: string,
  relativePath: string,
  maxSize = 1_000_000,
): string | null {
  if (relativePath.includes('..')) return null;
  const realRoot = safeRealpath(projectRoot);
  const candidate = path.resolve(realRoot, relativePath);
  if (!candidate.startsWith(realRoot + path.sep) && candidate !== realRoot) {
    return null;
  }
  try {
    const real = fs.realpathSync(candidate);
    if (!real.startsWith(realRoot + path.sep) && real !== realRoot) {
      return null;
    }
    const stat = fs.statSync(real);
    if (stat.size > maxSize) return null;
    return fs.readFileSync(real, 'utf8');
  } catch {
    return null;
  }
}

export function listFiles(
  projectRoot: string,
  relativeDir: string = '.',
  max = 1000,
): string[] {
  if (relativeDir.includes('..')) return [];
  const realRoot = safeRealpath(projectRoot);
  const dir = path.resolve(realRoot, relativeDir);
  if (!dir.startsWith(realRoot + path.sep) && dir !== realRoot) return [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const e of entries) {
      if (out.length >= max) break;
      // Skip common noise directories.
      if (e.isDirectory() && ['node_modules', '.git', 'dist', 'build', '.next', 'target', 'vendor'].includes(e.name)) continue;
      out.push(path.relative(realRoot, path.join(dir, e.name)));
    }
    return out.sort();
  } catch {
    return [];
  }
}
