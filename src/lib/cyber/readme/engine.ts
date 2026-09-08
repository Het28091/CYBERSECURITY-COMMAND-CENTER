// README Intelligence Engine.
// Parses README files, extracts install/build/run/test/dev commands, and
// cross-checks them against the actual project files. Every inference is
// labelled with confidence + evidence + source.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { safeReadFile } from '@/lib/cyber/security/path';
import { DiscoverySnapshot } from '@/lib/cyber/discovery/engine';

export type ReadmeConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ReadmeSource = 'readme' | 'manifest' | 'discovery' | 'ai' | 'user';

export interface ReadmeCommand {
  kind: 'install' | 'build' | 'run' | 'test' | 'dev' | 'docker' | 'env';
  command: string;          // the command as written in README
  executable: string;        // parsed executable (e.g. "npm", "python", "docker")
  args: string[];           // parsed argv
  confidence: ReadmeConfidence;
  evidence: string[];       // README line + verification file (if any)
  source: ReadmeSource;
  conflict: string | null;  // human-readable conflict description
  verified: boolean;        // true when cross-check passed
}

export interface ReadmeInferenceResult {
  readmePath: string | null;
  readmeLines: number;
  commands: ReadmeCommand[];
  warnings: string[];
  conflicts: { kind: string; message: string }[];
  rendered: string;        // raw README text (UI can render it)
}

const README_CANDIDATES = ['README.md', 'README.rst', 'README.txt', 'README', 'readme.md', 'readme.txt'];

export async function analyzeReadme(projectPath: string, discovery?: DiscoverySnapshot): Promise<ReadmeInferenceResult> {
  const result: ReadmeInferenceResult = {
    readmePath: null,
    readmeLines: 0,
    commands: [],
    warnings: [],
    conflicts: [],
    rendered: '',
  };

  const readmeName = README_CANDIDATES.find((n) => fs.existsSync(path.join(projectPath, n)));
  if (!readmeName) {
    result.warnings.push('No README file found');
    return result;
  }
  result.readmePath = readmeName;
  const raw = safeReadFile(projectPath, readmeName) ?? '';
  result.rendered = raw;
  result.readmeLines = raw.split(/\r?\n/).length;

  // Extract fenced code block commands and bare inline commands.
  const blocks = extractCodeBlocks(raw);
  for (const block of blocks) {
    for (const line of block.lines) {
      const cmd = parseCommandLine(line, readmeName, block.lineNumber);
      if (cmd) result.commands.push(cmd);
    }
  }

  // Cross-check each command against actual project files.
  for (const cmd of result.commands) {
    crossCheck(cmd, projectPath, discovery);
    if (cmd.conflict) result.conflicts.push({ kind: cmd.kind, message: cmd.conflict });
  }

  return result;
}

interface CodeBlock { language: string; lines: string[]; lineNumber: number }

function extractCodeBlocks(raw: string): CodeBlock[] {
  const out: CodeBlock[] = [];
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const fence = lines[i].match(/^\s*```(\w+)?/);
    if (fence) {
      const lang = fence[1] ?? 'text';
      const startLine = i + 1;
      const block: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      out.push({ language: lang, lines: block, lineNumber: startLine });
      i++;
    } else {
      i++;
    }
  }
  return out;
}

function parseCommandLine(line: string, source: string, lineNum: number): ReadmeCommand | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return null;
  // Strip leading `$` or `>` prompts.
  const cleaned = trimmed.replace(/^[$>]\s+/, '');
  if (!cleaned) return null;
  // Only accept lines that look like a shell command (contain a known verb).
  const tokens = cleaned.split(/\s+/);
  if (tokens.length === 0) return null;
  const exe = tokens[0];
  const knownExecutables = ['npm', 'yarn', 'pnpm', 'bun', 'node', 'npx',
    'python', 'python3', 'pip', 'pipenv', 'poetry', 'uv', 'uvicorn', 'gunicorn',
    'go', 'cargo', 'ruby', 'bundle', 'gem', 'rake',
    'php', 'composer', 'java', 'mvn', 'gradle',
    'make', 'docker', 'docker-compose', 'git', 'curl', 'wget', 'bash', 'sh'];
  if (!knownExecutables.includes(exe)) return null;

  const args = tokens.slice(1);
  const kind = classifyCommand(exe, args);
  if (!kind) return null;

  // Confidence starts at MEDIUM (README text only). Cross-check can upgrade to
  // HIGH (manifest evidence) or downgrade to LOW (conflict).
  return {
    kind,
    command: cleaned,
    executable: exe,
    args,
    confidence: 'MEDIUM',
    evidence: [`${source}:line ${lineNum}`],
    source: 'readme',
    conflict: null,
    verified: false,
  };
}

function classifyCommand(exe: string, args: string[]): ReadmeCommand['kind'] | null {
  const j = `${exe} ${args.join(' ')}`;
  if (/(npm|yarn|pnpm|bun)\s+(install|add|i|ci|up)/.test(j)) return 'install';
  if (/(pip|pipenv|poetry|uv)\s+install/.test(j)) return 'install';
  if (/composer\s+(install|require)/.test(j)) return 'install';
  if (/bundle\s+install/.test(j)) return 'install';
  if (/cargo\s+build/.test(j)) return 'build';
  if (/make\s+build/.test(j)) return 'build';
  if (/(npm|yarn|pnpm|bun)\s+run\s+build/.test(j)) return 'build';
  if (/npm\s+run\s+dev/.test(j)) return 'dev';
  if (/(yarn|pnpm|bun)\s+dev/.test(j)) return 'dev';
  if (/(npm|yarn|pnpm|bun)\s+(test|run\s+test)/.test(j)) return 'test';
  if (/pytest\b/.test(j)) return 'test';
  if (/cargo\s+test/.test(j)) return 'test';
  if (/go\s+test/.test(j)) return 'test';
  if (/rspec\b/.test(j)) return 'test';
  if (/docker[- ]compose\s+(up|start)/.test(j)) return 'docker';
  if (/docker\s+build/.test(j)) return 'docker';
  if (/docker\s+run/.test(j)) return 'docker';
  if (/(npm|yarn|pnpm|bun)\s+(start|run\s+start)/.test(j)) return 'run';
  if (/(npm|yarn|pnpm|bun)\s+run/.test(j)) return 'run';
  if (/python\s+\S+\.py/.test(j)) return 'run';
  if (/python3?\s+-m\s+\S+/.test(j)) return 'run';
  if (/go\s+run/.test(j)) return 'run';
  if (/cargo\s+run/.test(j)) return 'run';
  if (/bundle\s+exec\s+rails\s+server/.test(j)) return 'run';
  if (/php\s+(artisan|index\.php)/.test(j)) return 'run';
  if (/uvicorn\s+/.test(j)) return 'run';
  if (/gunicorn\s+/.test(j)) return 'run';
  if (/java\s+-jar/.test(j)) return 'run';
  if (/make\s+\w+/.test(j)) return 'run';
  if (/^(npm|yarn|pnpm|bun)$/.test(exe) && args.length === 0) return null;
  return null;
}

function crossCheck(cmd: ReadmeCommand, projectPath: string, discovery?: DiscoverySnapshot) {
  const exists = (rel: string) => fs.existsSync(path.join(projectPath, rel));
  const hasScript = (name: string) => {
    const pkgPath = safeReadFile(projectPath, 'package.json');
    if (!pkgPath) return false;
    try {
      const pkg = JSON.parse(pkgPath);
      return Boolean(pkg.scripts && pkg.scripts[name]);
    } catch {
      return false;
    }
  };

  let verified = false;
  let conflict: string | null = null;

  if (cmd.executable === 'npm' || cmd.executable === 'yarn' || cmd.executable === 'pnpm' || cmd.executable === 'bun') {
    const scriptName = cmd.args.find((a, i) => cmd.args[i - 1] === 'run');
    if (scriptName) {
      if (hasScript(scriptName)) {
        verified = true;
        cmd.evidence.push(`package.json:scripts.${scriptName}`);
      } else {
        conflict = `README references "${cmd.executable} run ${scriptName}" but package.json has no such script`;
      }
    } else if (cmd.args[0] === 'install' || cmd.args[0] === 'i' || cmd.args[0] === 'add' || cmd.args[0] === 'ci') {
      // install commands are always "verified" if a manifest exists.
      if (exists('package.json')) {
        verified = true;
        cmd.evidence.push('package.json (manifest present)');
      } else {
        conflict = `${cmd.executable} install referenced in README, but no package.json found`;
      }
    }
  } else if (cmd.executable === 'python' || cmd.executable === 'python3') {
    const target = cmd.args.find((a) => a.endsWith('.py'));
    if (target) {
      if (exists(target)) {
        verified = true;
        cmd.evidence.push(`${target} exists`);
      } else {
        conflict = `README references "${cmd.executable} ${target}" but file not found`;
      }
    } else if (cmd.args[0] === '-m') {
      verified = true; // we cannot easily verify a module without running it
      cmd.evidence.push('python -m module invocation');
    }
  } else if (cmd.executable === 'docker' || cmd.executable === 'docker-compose') {
    const hasDockerfile = exists('Dockerfile');
    const hasCompose = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].some((p) => exists(p));
    if (hasDockerfile || hasCompose) {
      verified = true;
      cmd.evidence.push(hasDockerfile ? 'Dockerfile present' : 'compose file present');
    } else {
      conflict = 'README references Docker but no Dockerfile/compose file found';
    }
  } else if (cmd.executable === 'make') {
    if (exists('Makefile')) {
      const target = cmd.args[0];
      const mk = safeReadFile(projectPath, 'Makefile') ?? '';
      if (new RegExp(`^${target}:`, 'm').test(mk)) {
        verified = true;
        cmd.evidence.push(`Makefile:${target}`);
      } else {
        conflict = `README references "make ${target}" but no such target in Makefile`;
      }
    } else {
      conflict = 'README references make but no Makefile found';
    }
  } else if (cmd.executable === 'go' && cmd.args[0] === 'run') {
    if (exists('go.mod') && exists('main.go')) {
      verified = true;
      cmd.evidence.push('go.mod + main.go present');
    } else {
      conflict = 'README references "go run" but go.mod or main.go missing';
    }
  } else if (cmd.executable === 'cargo' && cmd.args[0] === 'run') {
    if (exists('Cargo.toml') && exists('src/main.rs')) {
      verified = true;
      cmd.evidence.push('Cargo.toml + src/main.rs present');
    } else {
      conflict = 'README references "cargo run" but Cargo.toml or src/main.rs missing';
    }
  }

  cmd.verified = verified;
  cmd.conflict = conflict;
  if (verified) cmd.confidence = 'HIGH';
  else if (conflict) cmd.confidence = 'LOW';
  else cmd.confidence = 'MEDIUM';

  // If discovery says the language does not match the command's executable
  // family, mark a low-confidence conflict.
  if (discovery) {
    const fam = discovery.language;
    const cmdFamily =
      ['npm', 'yarn', 'pnpm', 'bun', 'node', 'npx'].includes(cmd.executable) ? 'javascript' :
      ['python', 'python3', 'pip', 'pipenv', 'poetry', 'uv', 'uvicorn', 'gunicorn'].includes(cmd.executable) ? 'python' :
      ['go'].includes(cmd.executable) ? 'go' :
      ['cargo', 'rustc'].includes(cmd.executable) ? 'rust' :
      ['ruby', 'bundle', 'gem', 'rake'].includes(cmd.executable) ? 'ruby' :
      ['php', 'composer'].includes(cmd.executable) ? 'php' :
      ['java', 'mvn', 'gradle'].includes(cmd.executable) ? 'java' :
      ['docker', 'docker-compose'].includes(cmd.executable) ? 'container' :
      ['make'].includes(cmd.executable) ? 'make' :
      'unknown';
    if (cmdFamily !== 'unknown' && fam !== 'UNKNOWN' && fam !== cmdFamily && fam !== 'typescript') {
      cmd.confidence = 'LOW';
      if (!cmd.conflict) {
        cmd.conflict = `README command family "${cmdFamily}" does not match discovered language "${fam}"`;
      }
    }
  }
}
