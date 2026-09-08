// Scanner plugin architecture.
// Each scanner implements the Scanner interface. The runner picks scanners
// by id, executes them against a project, and persists findings.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { safeReadFile, listFiles } from '@/lib/cyber/security/path';
import { redact } from '@/lib/cyber/security/redact';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'high' | 'medium' | 'low';

export interface Finding {
  scanner: string;
  severity: Severity;
  rule: string;
  title: string;
  description: string;
  evidence: string;     // file path + line + matched text (redacted)
  confidence: Confidence;
}

export interface ScanResult {
  scanner: string;
  summary: Record<string, number>;
  findings: Finding[];
  warnings: string[];
}

export interface Scanner {
  id: string;
  name: string;
  category: string;
  description: string;
  supported: boolean;
  scan(projectPath: string): Promise<ScanResult>;
}

// ─── Dependency scanner ───────────────────────────────────────────────────────

export const dependencyScanner: Scanner = {
  id: 'dependency',
  name: 'Dependency Inventory',
  category: 'inventory',
  description: 'Parses package manifests and lists dependencies with versions. Flags pinned, outdated, or suspicious packages.',
  supported: true,
  async scan(projectPath: string): Promise<ScanResult> {
    const findings: Finding[] = [];
    const warnings: string[] = [];
    const summary: Record<string, number> = { total: 0, pinned: 0, caret: 0, tilde: 0, latest: 0, unknown: 0 };

    const pkgPath = safeReadFile(projectPath, 'package.json');
    if (pkgPath) {
      try {
        const pkg = JSON.parse(pkgPath);
        for (const [name, version] of Object.entries({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) })) {
          summary.total++;
          const v = String(version);
          let severity: Severity = 'info';
          let confidence: Confidence = 'high';
          if (v === '*' || v === 'latest') { severity = 'medium'; summary.latest++; }
          else if (v.startsWith('^')) { summary.caret++; }
          else if (v.startsWith('~')) { summary.tilde++; }
          else if (/^\d+\.\d+\.\d+/.test(v)) { summary.pinned++; }
          else { summary.unknown++; confidence = 'medium'; }
          findings.push({
            scanner: 'dependency',
            severity,
            rule: 'dep-inventory',
            title: name,
            description: `Declared version: ${redact(v)}`,
            evidence: `package.json → dependencies.${name}`,
            confidence,
          });
        }
      } catch (e) {
        warnings.push(`package.json parse failed: ${(e as Error).message}`);
      }
    }

    const requirements = safeReadFile(projectPath, 'requirements.txt');
    if (requirements) {
      for (const line of requirements.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const m = trimmed.match(/^([A-Za-z0-9_\-\.]+)([<>=!~]=?.*)?$/);
        if (m) {
          summary.total++;
          findings.push({
            scanner: 'dependency',
            severity: m[2] ? 'info' : 'medium',
            rule: 'dep-inventory',
            title: m[1],
            description: `Declared version constraint: ${m[2] ?? 'unpinned'}`,
            evidence: `requirements.txt → ${m[1]}`,
            confidence: 'high',
          });
        }
      }
    }

    const cargo = safeReadFile(projectPath, 'Cargo.toml');
    if (cargo) {
      // Naive scan: extract [dependencies] section lines.
      const depsMatch = cargo.match(/\[dependencies\]\s*\n([\s\S]*?)(\n\[|\n$|$)/);
      if (depsMatch) {
        for (const line of depsMatch[1].split(/\r?\n/)) {
          const m = line.match(/^([A-Za-z0-9_\-]+)\s*=\s*"?([^"\s]+)"?/);
          if (m) {
            summary.total++;
            findings.push({
              scanner: 'dependency',
              severity: 'info',
              rule: 'dep-inventory',
              title: m[1],
              description: `Crate version: ${m[2]}`,
              evidence: `Cargo.toml → ${m[1]}`,
              confidence: 'high',
            });
          }
        }
      }
    }

    const gomod = safeReadFile(projectPath, 'go.mod');
    if (gomod) {
      for (const line of gomod.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z0-9_\-\.]+\/[A-Za-z0-9_\-\.]+)\s+v([0-9].+)/);
        if (m) {
          summary.total++;
          findings.push({
            scanner: 'dependency',
            severity: 'info',
            rule: 'dep-inventory',
            title: m[1],
            description: `Go module version: ${m[2]}`,
            evidence: `go.mod → ${m[1]}`,
            confidence: 'high',
          });
        }
      }
    }

    if (summary.total === 0) warnings.push('No supported dependency manifests found');
    return { scanner: 'dependency', summary, findings, warnings };
  },
};

// ─── Secret scanner ──────────────────────────────────────────────────────────

const SECRET_PATTERNS: { name: string; re: RegExp; severity: Severity; confidence: Confidence }[] = [
  { name: 'AWS Access Key', re: /\bAKIA[0-9A-Z]{16}\b/g, severity: 'critical', confidence: 'high' },
  { name: 'AWS Secret Key (long)', re: /\baws_secret_access_key\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi, severity: 'critical', confidence: 'high' },
  { name: 'GitHub PAT', re: /\bghp_[A-Za-z0-9]{36,}\b/g, severity: 'critical', confidence: 'high' },
  { name: 'GitHub Fine-grained PAT', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, severity: 'critical', confidence: 'high' },
  { name: 'Slack Token', re: /\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/g, severity: 'high', confidence: 'high' },
  { name: 'Stripe Secret Key', re: /\bsk_(?:test_|live_)?[A-Za-z0-9]{20,}\b/g, severity: 'critical', confidence: 'high' },
  { name: 'Private Key Block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, severity: 'critical', confidence: 'high' },
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g, severity: 'high', confidence: 'medium' },
  { name: 'Generic API Key Assignment', re: /\b(?:api[_-]?key|API[_-]?KEY)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?/g, severity: 'high', confidence: 'medium' },
  { name: 'Generic Secret Assignment', re: /\b(?:secret|SECRET|password|PASSWORD)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{16,}['"]?/g, severity: 'high', confidence: 'medium' },
  { name: 'Bearer Token', re: /\bBearer\s+[A-Za-z0-9_\-\.=]{20,}/g, severity: 'medium', confidence: 'medium' },
  { name: 'URL with Basic Auth', re: /\bhttps?:\/\/[^:@\s]+:[^@\s]+@[^\s/]+/g, severity: 'medium', confidence: 'high' },
];

export const secretScanner: Scanner = {
  id: 'secret',
  name: 'Secret Scanner',
  category: 'secret-detection',
  description: 'Scans source files for high-signal secret patterns (AWS, GitHub, Slack, Stripe, JWT, private keys, generic assignments).',
  supported: true,
  async scan(projectPath: string): Promise<ScanResult> {
    const findings: Finding[] = [];
    const warnings: string[] = [];
    const summary: Record<string, number> = { total: 0, files: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };

    // Files to scan: source files only, skip node_modules/.git/large binaries.
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'target', 'vendor', 'vendor', 'cache', '.cache']);
    const exts = new Set(['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.json', '.py', '.rb', '.go', '.rs', '.java', '.php', '.env', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh', '.bash', '.zsh', '.md', '.txt']);
    const queue: string[] = [projectPath];
    let filesScanned = 0;
    while (queue.length > 0 && filesScanned < 200) {
      const dir = queue.shift()!;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch { continue; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (skipDirs.has(e.name)) continue;
          queue.push(full);
        } else if (e.isFile()) {
          if (e.name === '.env' || e.name === '.env.local') {
            // Scan .env files (they're a common leak target).
            scanFile(full, projectPath, findings, summary);
            filesScanned++;
          } else if (exts.has(path.extname(e.name))) {
            scanFile(full, projectPath, findings, summary);
            filesScanned++;
          }
        }
        if (filesScanned >= 200) break;
      }
    }

    if (summary.total === 0) warnings.push('No secrets detected from the configured patterns');
    summary.files = filesScanned;
    return { scanner: 'secret', summary, findings, warnings };
  },
};

function scanFile(fullPath: string, projectRoot: string, findings: Finding[], summary: Record<string, number>) {
  let content: string;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch { return; }
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(content)) !== null) {
      const line = content.slice(0, m.index).split('\n').length;
      const matched = m[0];
      // Skip obvious placeholders.
      if (/^(placeholder|changeme|your[_-]?(?:key|token|secret)|example|xxx+)$/i.test(matched)) continue;
      findings.push({
        scanner: 'secret',
        severity: p.severity,
        rule: p.name,
        title: p.name,
        description: `Possible ${p.name} in ${path.relative(projectRoot, fullPath)}:${line}`,
        evidence: `${path.relative(projectRoot, fullPath)}:${line}: ${redact(matched)}`,
        confidence: p.confidence,
      });
      summary.total++;
      summary[p.severity]++;
    }
  }
}

// ─── Configuration scanner ────────────────────────────────────────────────────

export const configScanner: Scanner = {
  id: 'config',
  name: 'Configuration Scanner',
  category: 'configuration',
  description: 'Scans env, docker, compose, and IaC basics for unsafe defaults (bind 0.0.0.0, missing TLS, plain HTTP, secret-in-env).',
  supported: true,
  async scan(projectPath: string): Promise<ScanResult> {
    const findings: Finding[] = [];
    const warnings: string[] = [];
    const summary: Record<string, number> = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };

    // env files
    for (const envFile of ['.env', '.env.local', '.env.example']) {
      const env = safeReadFile(projectPath, envFile);
      if (!env) continue;
      for (const line of env.split(/\r?\n/)) {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        const name = m[1]; const val = m[2];
        // Bind 0.0.0.0
        if (/0\.0\.0\.0/.test(val) && /host|bind|listen/i.test(name)) {
          findings.push({
            scanner: 'config', severity: 'medium', rule: 'bind-all-interfaces',
            title: `Bind to 0.0.0.0 in ${envFile}`,
            description: `${name} binds to all interfaces. Prefer localhost for management interfaces.`,
            evidence: `${envFile} → ${name}`, confidence: 'high',
          });
          summary.total++; summary.medium++;
        }
        // Plain HTTP for an authentication-related variable
        if (/^http:\/\//i.test(val) && /auth|token|secret|password|jwt/i.test(name)) {
          findings.push({
            scanner: 'config', severity: 'high', rule: 'plain-http-auth',
            title: `Plain HTTP used for ${name}`,
            description: `${envFile} sets ${name} to a plain HTTP URL. Use HTTPS for credentials.`,
            evidence: `${envFile} → ${name}`, confidence: 'high',
          });
          summary.total++; summary.high++;
        }
        // Debug flag in env
        if (/^(DEBUG|NODE_ENV|FLASK_ENV)$/.test(name) && /development|true|1/i.test(val)) {
          findings.push({
            scanner: 'config', severity: 'low', rule: 'debug-in-env',
            title: `Debug flag enabled in ${envFile}`,
            description: `${name}=${val} — ensure this is not the production default.`,
            evidence: `${envFile} → ${name}`, confidence: 'high',
          });
          summary.total++; summary.low++;
        }
      }
    }

    // Dockerfile checks
    const dockerfile = safeReadFile(projectPath, 'Dockerfile');
    if (dockerfile) {
      // Running as root
      if (!/USER\s+\w+/.test(dockerfile)) {
        findings.push({
          scanner: 'config', severity: 'medium', rule: 'docker-no-user',
          title: 'Dockerfile has no USER directive',
          description: 'Container will run as root by default. Add a non-root USER.',
          evidence: 'Dockerfile (no USER directive)', confidence: 'high',
        });
        summary.total++; summary.medium++;
      }
      // :latest tag
      if (/FROM\s+\S+:latest\b/.test(dockerfile)) {
        findings.push({
          scanner: 'config', severity: 'low', rule: 'docker-latest-tag',
          title: 'Dockerfile uses :latest tag',
          description: 'Pin a specific base image version for reproducibility.',
          evidence: 'Dockerfile (FROM :latest)', confidence: 'high',
        });
        summary.total++; summary.low++;
      }
    }

    // Compose checks
    const composeFile = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
      .map((n) => ({ name: n, content: safeReadFile(projectPath, n) }))
      .find((x) => x.content);
    if (composeFile?.content) {
      if (/ports:\s*\n\s*-\s*["']?0\.0\.0\.0:\d+/.test(composeFile.content)) {
        findings.push({
          scanner: 'config', severity: 'medium', rule: 'compose-bind-public',
          title: 'Compose binds ports to 0.0.0.0',
          description: `Service in ${composeFile.name} binds to all interfaces. Prefer 127.0.0.1.`,
          evidence: `${composeFile.name} (ports: 0.0.0.0:...)`, confidence: 'high',
        });
        summary.total++; summary.medium++;
      }
    }

    if (summary.total === 0) warnings.push('No unsafe configuration defaults detected');
    return { scanner: 'config', summary, findings, warnings };
  },
};

// ─── Registry ──────────────────────────────────────────────────────────────────

export const SCANNERS: Scanner[] = [dependencyScanner, secretScanner, configScanner];

export function listScannerMeta() {
  return SCANNERS.map((s) => ({
    id: s.id, name: s.name, category: s.category,
    description: s.description, supported: s.supported,
  }));
}

export function getScanner(id: string): Scanner | null {
  return SCANNERS.find((s) => s.id === id) ?? null;
}
