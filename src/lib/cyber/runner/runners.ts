// Project Runner registry.
// Each runner knows how to (a) detect whether it applies to a project, and
// (b) build a resolved command for a given action (run/stop/restart).
//
// GAP-008 fix: runners now load `.env.example`-declared env vars into the
// spawn env at run time. The process manager strips dangerous vars
// (PATH, LD_PRELOAD, etc.) before the spawn.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DiscoverySnapshot } from '@/lib/cyber/discovery/engine';
import { ReadmeCommand } from '@/lib/cyber/readme/engine';

export type RunAction = 'run' | 'dev' | 'build' | 'test';

export interface ResolvedCommand {
  executable: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  source: 'manifest' | 'readme' | 'discovery' | 'user' | 'ai';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];
  display: string;     // for UI display only — never used for execution
}

export interface RunnerDetection {
  applies: boolean;
  priority: number;    // lower = preferred
  reason: string;
}

export interface ProjectRunner {
  id: string;
  displayName: string;
  supported: boolean;          // false when runtime not installed
  unsupportedReason?: string;
  detect(projectPath: string, discovery: DiscoverySnapshot): RunnerDetection;
  buildCommand(action: RunAction, projectPath: string, discovery: DiscoverySnapshot, readmeCommands: ReadmeCommand[]): ResolvedCommand | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function which(exe: string): boolean {
  try {
    // Quick PATH check. We do not run the executable.
    const paths = (process.env.PATH || '').split(':');
    for (const p of paths) {
      if (fs.existsSync(path.join(p, exe))) return true;
      if (fs.existsSync(path.join(p, `${exe}.exe`))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function pickReadme(readmeCommands: ReadmeCommand[], kind: string): ReadmeCommand | undefined {
  // Prefer verified commands of the requested kind.
  return readmeCommands.find((c) => c.kind === kind && c.verified)
      ?? readmeCommands.find((c) => c.kind === kind);
}

function fromReadme(cmd: ReadmeCommand | undefined, cwd: string, timeoutMs: number): ResolvedCommand | null {
  if (!cmd) return null;
  return {
    executable: cmd.executable,
    args: cmd.args,
    cwd,
    env: {},
    timeoutMs,
    source: 'readme',
    confidence: cmd.confidence,
    evidence: cmd.evidence,
    display: cmd.command,
  };
}

function fromManifest(exe: string, args: string[], cwd: string, evidence: string[], display: string, timeoutMs: number, env?: Record<string,string>): ResolvedCommand {
  return {
    executable: exe,
    args,
    cwd,
    env: env ?? {},
    timeoutMs,
    source: 'manifest',
    confidence: 'HIGH',
    evidence,
    display,
  };
}

const DEFAULT_TIMEOUT = 60000;

/**
 * Load env vars from `.env.example` in the project. Returns a Record
 * mapping var name → value. Placeholder values are kept as-is (the user
 * can fill in real values in their own .env file at run time, but for
 * dry-run / discovery we keep the placeholder so the project can start).
 *
 * Returns an empty record if `.env.example` doesn't exist or is empty.
 */
function loadEnvExample(projectPath: string): Record<string, string> {
  const out: Record<string, string> = {};
  const candidates = ['.env', '.env.local', '.env.example'];
  for (const name of candidates) {
    const full = path.join(projectPath, name);
    if (!fs.existsSync(full)) continue;
    try {
      const content = fs.readFileSync(full, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) {
          let v = m[2].trim();
          // Strip surrounding quotes
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          out[m[1]] = v;
        }
      }
    } catch { /* ignore */ }
  }
  return out;
}

// ─── Node runner ─────────────────────────────────────────────────────────────

export const nodeRunner: ProjectRunner = {
  id: 'node',
  displayName: 'Node.js / npm',
  supported: which('node') && which('npm'),
  detect(_p, d) {
    const applies = d.language === 'javascript' || d.language === 'typescript';
    return { applies, priority: 1, reason: applies ? 'Node project detected' : 'Not a Node project' };
  },
  buildCommand(action, projectPath, d, readme) {
    if (!nodeRunner.supported) return null;
    const pm = d.packageManager === 'pnpm' ? 'pnpm' :
               d.packageManager === 'yarn' ? 'yarn' :
               d.packageManager === 'bun' ? 'bun' : 'npm';
    const env = loadEnvExample(projectPath); // ← GAP-008 fix
    // Try manifest first.
    try {
      const pkgPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts = pkg.scripts || {};
        const target =
          action === 'dev' ? scripts.dev :
          action === 'build' ? scripts.build :
          action === 'test' ? scripts.test :
          scripts.start ?? scripts.dev;
        if (target) {
          return fromManifest(pm, ['run', action === 'run' ? 'start' : action], projectPath,
            [`package.json:scripts.${action === 'run' ? 'start' : action}`], `${pm} run ${action === 'run' ? 'start' : action}`, DEFAULT_TIMEOUT, env);
        }
      }
    } catch { /* ignore */ }
    // Fallback to README.
    const readmeCmd = pickReadme(readme, action === 'run' ? 'run' : action);
    return fromReadme(readmeCmd, projectPath, DEFAULT_TIMEOUT);
  },
};

// ─── Python runner ───────────────────────────────────────────────────────────

export const pythonRunner: ProjectRunner = {
  id: 'python',
  displayName: 'Python (pip / poetry / pipenv / uv)',
  supported: which('python3') || which('python'),
  detect(_p, d) {
    const applies = d.language === 'python';
    return { applies, priority: 2, reason: applies ? 'Python project detected' : 'Not a Python project' };
  },
  buildCommand(action, projectPath, d, readme) {
    if (!pythonRunner.supported) return null;
    const env = loadEnvExample(projectPath); // ← GAP-008 fix
    if (action === 'dev' || action === 'run') {
      const entry = d.entryPoint;
      if (entry && entry.startsWith('python ')) {
        return fromManifest('python3', [entry.replace(/^python(?:3)?\s+/, '')], projectPath,
          ['pyproject.toml/requirements.txt:entryPoint'], entry, DEFAULT_TIMEOUT, env);
      }
      // Try README.
      const readmeCmd = pickReadme(readme, 'run');
      return fromReadme(readmeCmd, projectPath, DEFAULT_TIMEOUT);
    }
    if (action === 'test') {
      const readmeCmd = pickReadme(readme, 'test');
      if (readmeCmd) return fromReadme(readmeCmd, projectPath, DEFAULT_TIMEOUT);
      if (fs.existsSync(path.join(projectPath, 'pytest.ini')) || fs.existsSync(path.join(projectPath, 'pyproject.toml'))) {
        return fromManifest('pytest', [], projectPath, ['pytest.ini or pyproject.toml'], 'pytest', DEFAULT_TIMEOUT, env);
      }
    }
    if (action === 'build') {
      const readmeCmd = pickReadme(readme, 'build');
      return fromReadme(readmeCmd, projectPath, DEFAULT_TIMEOUT);
    }
    return null;
  },
};

// ─── Go runner ────────────────────────────────────────────────────────────────

export const goRunner: ProjectRunner = {
  id: 'go',
  displayName: 'Go',
  supported: which('go'),
  unsupportedReason: 'Go runtime is not installed in this environment',
  detect(_p, d) {
    const applies = d.language === 'go';
    return { applies, priority: 3, reason: applies ? 'Go project detected' : 'Not a Go project' };
  },
  buildCommand(action, projectPath, d, readme) {
    if (!goRunner.supported) return null;
    if (action === 'dev' || action === 'run') {
      if (fs.existsSync(path.join(projectPath, 'main.go'))) {
        return fromManifest('go', ['run', '.'], projectPath, ['main.go'], 'go run .', DEFAULT_TIMEOUT);
      }
    }
    if (action === 'test') return fromManifest('go', ['test', './...'], projectPath, ['go.mod'], 'go test ./...', DEFAULT_TIMEOUT);
    if (action === 'build') return fromManifest('go', ['build', '.'], projectPath, ['go.mod'], 'go build .', DEFAULT_TIMEOUT);
    const readmeCmd = pickReadme(readme, action === 'dev' ? 'run' : action);
    return fromReadme(readmeCmd, projectPath, DEFAULT_TIMEOUT);
  },
};

// ─── Rust runner ──────────────────────────────────────────────────────────────

export const rustRunner: ProjectRunner = {
  id: 'rust',
  displayName: 'Rust (cargo)',
  supported: which('cargo'),
  unsupportedReason: 'Rust/Cargo is not installed in this environment',
  detect(_p, d) {
    const applies = d.language === 'rust';
    return { applies, priority: 4, reason: applies ? 'Rust project detected' : 'Not a Rust project' };
  },
  buildCommand(action, projectPath, _d, readme) {
    if (!rustRunner.supported) return null;
    if (action === 'dev' || action === 'run') return fromManifest('cargo', ['run'], projectPath, ['Cargo.toml'], 'cargo run', DEFAULT_TIMEOUT);
    if (action === 'test') return fromManifest('cargo', ['test'], projectPath, ['Cargo.toml'], 'cargo test', DEFAULT_TIMEOUT);
    if (action === 'build') return fromManifest('cargo', ['build'], projectPath, ['Cargo.toml'], 'cargo build', DEFAULT_TIMEOUT);
    const readmeCmd = pickReadme(readme, action === 'dev' ? 'run' : action);
    return fromReadme(readmeCmd, projectPath, DEFAULT_TIMEOUT);
  },
};

// ─── Docker runner ────────────────────────────────────────────────────────────

export const dockerRunner: ProjectRunner = {
  id: 'docker',
  displayName: 'Docker / Compose',
  supported: which('docker'),
  unsupportedReason: 'Docker is not installed in this environment',
  detect(_p, d) {
    const applies = d.containerConfig.type !== 'none';
    return { applies, priority: 5, reason: applies ? 'Container config detected' : 'No container config' };
  },
  buildCommand(action, projectPath, d, readme) {
    if (!dockerRunner.supported) return null;
    if (action === 'dev' || action === 'run') {
      const composeFile = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
        .find((p) => fs.existsSync(path.join(projectPath, p)));
      if (composeFile) {
        return fromManifest('docker', ['compose', '-f', composeFile, 'up'], projectPath,
          [composeFile], `docker compose -f ${composeFile} up`, DEFAULT_TIMEOUT * 5);
      }
      if (fs.existsSync(path.join(projectPath, 'Dockerfile'))) {
        return fromManifest('docker', ['build', '-t', 'cybercc-runner', '.'], projectPath,
          ['Dockerfile'], 'docker build -t cybercc-runner .', DEFAULT_TIMEOUT * 5);
      }
    }
    const readmeCmd = pickReadme(readme, action === 'run' ? 'docker' : action);
    return fromReadme(readmeCmd, projectPath, DEFAULT_TIMEOUT * 5);
  },
};

// ─── Shell runner (Makefile, scripts) ─────────────────────────────────────────

export const shellRunner: ProjectRunner = {
  id: 'shell',
  displayName: 'Shell / Make',
  supported: which('bash') || which('sh'),
  detect(_p, d) {
    const applies = d.entryPoint.startsWith('make ');
    return { applies, priority: 6, reason: applies ? 'Makefile-based project' : 'Not a make project' };
  },
  buildCommand(action, projectPath, d, _readme) {
    if (!shellRunner.supported) return null;
    if (action === 'dev' || action === 'run') {
      const m = d.entryPoint.match(/^make\s+(\w+)/);
      if (m) {
        return fromManifest('make', [m[1]], projectPath, [`Makefile:${m[1]}`], `make ${m[1]}`, DEFAULT_TIMEOUT);
      }
    }
    return null;
  },
};

// ─── Registry ──────────────────────────────────────────────────────────────────

export const RUNNERS: ProjectRunner[] = [nodeRunner, pythonRunner, goRunner, rustRunner, dockerRunner, shellRunner];

export function pickRunner(projectPath: string, discovery: DiscoverySnapshot): ProjectRunner | null {
  let best: ProjectRunner | null = null;
  let bestDet: RunnerDetection | null = null;
  for (const r of RUNNERS) {
    const det = r.detect(projectPath, discovery);
    if (det.applies) {
      if (!bestDet || det.priority < bestDet.priority) {
        best = r; bestDet = det;
      }
    }
  }
  return best;
}

export function isRuntimeInstalled(exe: string): boolean {
  return which(exe);
}
// force recompile 1788900956
