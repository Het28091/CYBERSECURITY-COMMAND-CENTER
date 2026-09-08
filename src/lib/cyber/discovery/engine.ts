// Project Discovery Engine.
// Reads (never executes) project files and infers language, framework,
// package manager, entry point, ports, env vars. Every non-UNKNOWN field
// is backed by evidence.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { safeReadFile, listFiles } from '@/lib/cyber/security/path';

export interface DiscoverySnapshot {
  language: string;
  framework: string;
  packageManager: string;
  techStack: string[];
  entryPoint: string;
  containerConfig: { type: 'dockerfile' | 'compose' | 'none'; ports: number[] };
  ports: number[];
  envVars: { name: string; required: boolean; defaultValue: string | null }[];
  manifestFiles: string[];
  conflicts: { field: string; left: string; right: string; source: string }[];
  warnings: string[];
  evidence: Record<string, string[]>;
}

const UNKNOWN = 'UNKNOWN';

export async function discover(projectPath: string): Promise<DiscoverySnapshot> {
  const snap: DiscoverySnapshot = {
    language: UNKNOWN,
    framework: UNKNOWN,
    packageManager: UNKNOWN,
    techStack: [],
    entryPoint: UNKNOWN,
    containerConfig: { type: 'none', ports: [] },
    ports: [],
    envVars: [],
    manifestFiles: [],
    conflicts: [],
    warnings: [],
    evidence: {},
  };

  const exists = (rel: string) => fs.existsSync(path.join(projectPath, rel));

  // ── package.json → Node ───────────────────────────────────────────────
  const pkgPath = safeReadFile(projectPath, 'package.json');
  if (pkgPath) {
    snap.manifestFiles.push('package.json');
    pushEvidence(snap, 'language', 'package.json');
    snap.language = 'javascript';
    try {
      const pkg = JSON.parse(pkgPath);
      snap.packageManager = detectNodePm(projectPath);
      pushEvidence(snap, 'packageManager', 'package.json');
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      const techs: string[] = [];
      let framework = UNKNOWN;
      if ('next' in deps) { framework = 'Next.js'; techs.push('Next.js'); }
      else if ('react' in deps && 'vite' in deps) { framework = 'Vite + React'; techs.push('Vite', 'React'); }
      else if ('react' in deps) { framework = 'React'; techs.push('React'); }
      else if ('vue' in deps) { framework = 'Vue'; techs.push('Vue'); }
      else if ('@sveltejs/kit' in deps) { framework = 'SvelteKit'; techs.push('SvelteKit'); }
      else if ('express' in deps) { framework = 'Express'; techs.push('Express'); }
      else if ('fastify' in deps) { framework = 'Fastify'; techs.push('Fastify'); }
      else if ('@nestjs/core' in deps) { framework = 'NestJS'; techs.push('NestJS'); }
      else if ('@remix-run/react' in deps) { framework = 'Remix'; techs.push('Remix'); }
      else if ('nuxt' in deps) { framework = 'Nuxt'; techs.push('Nuxt'); }
      if ('typescript' in deps) { techs.push('TypeScript'); snap.language = 'typescript'; }
      if ('tailwindcss' in deps) techs.push('TailwindCSS');
      if ('prisma' in deps || '@prisma/client' in deps) techs.push('Prisma');
      if ('drizzle-orm' in deps) techs.push('Drizzle');
      if ('socket.io' in deps) techs.push('Socket.io');
      if ('playwright' in deps) techs.push('Playwright');
      if ('jest' in deps || 'vitest' in deps) techs.push('Tests');
      snap.framework = framework;
      pushEvidence(snap, 'framework', 'package.json');
      snap.techStack = Array.from(new Set(techs));
      pushEvidence(snap, 'techStack', 'package.json');

      // Run command from scripts
      const scripts = pkg.scripts || {};
      if (scripts.dev) snap.entryPoint = `npm run dev`;
      else if (scripts.start) snap.entryPoint = `npm start`;
      if (snap.entryPoint !== UNKNOWN) pushEvidence(snap, 'entryPoint', 'package.json:scripts');

      // Port from scripts (e.g. "dev": "next dev -p 3000")
      for (const scriptText of Object.values(scripts)) {
        const m = String(scriptText).match(/(?:-p|--port)\s+(\d{2,5})/);
        if (m) {
          snap.ports.push(Number(m[1]));
          pushEvidence(snap, 'ports', `package.json:scripts`);
        }
      }
    } catch {
      snap.warnings.push('package.json could not be parsed');
    }
  }

  // ── pyproject.toml / requirements.txt → Python ─────────────────────
  const pyproject = safeReadFile(projectPath, 'pyproject.toml');
  const requirements = safeReadFile(projectPath, 'requirements.txt');
  if (pyproject || requirements) {
    if (snap.language !== UNKNOWN && snap.language !== 'python') {
      snap.conflicts.push({ field: 'language', left: snap.language, right: 'python', source: 'pyproject.toml/requirements.txt' });
    }
    snap.language = 'python';
    pushEvidence(snap, 'language', pyproject ? 'pyproject.toml' : 'requirements.txt');
    snap.manifestFiles.push(...(pyproject ? ['pyproject.toml'] : []), ...(requirements ? ['requirements.txt'] : []));

    if (fs.existsSync(path.join(projectPath, 'poetry.lock'))) snap.packageManager = 'poetry';
    else if (fs.existsSync(path.join(projectPath, 'Pipfile'))) snap.packageManager = 'pipenv';
    else if (fs.existsSync(path.join(projectPath, 'uv.lock'))) snap.packageManager = 'uv';
    else snap.packageManager = 'pip';
    pushEvidence(snap, 'packageManager', pyproject ? 'pyproject.toml' : 'requirements.txt');

    const content = pyproject ?? requirements ?? '';
    const techs = new Set<string>(snap.techStack);
    let framework = snap.framework === UNKNOWN ? UNKNOWN : snap.framework;
    if (/fastapi\b/i.test(content)) { framework = 'FastAPI'; techs.add('FastAPI'); }
    else if (/flask\b/i.test(content)) { framework = 'Flask'; techs.add('Flask'); }
    else if (/django\b/i.test(content)) { framework = 'Django'; techs.add('Django'); }
    else if (/starlette\b/i.test(content)) { framework = 'Starlette'; techs.add('Starlette'); }
    else if (/litestar\b/i.test(content)) { framework = 'Litestar'; techs.add('Litestar'); }
    else if (/sanic\b/i.test(content)) { framework = 'Sanic'; techs.add('Sanic'); }
    else if (/aiohttp\b/i.test(content)) { framework = 'aiohttp'; techs.add('aiohttp'); }
    if (/pydantic\b/i.test(content)) techs.add('Pydantic');
    if (/sqlalchemy\b/i.test(content)) techs.add('SQLAlchemy');
    if (/celery\b/i.test(content)) techs.add('Celery');
    if (/pytest\b/i.test(content)) techs.add('pytest');
    if (/uvicorn\b/i.test(content)) techs.add('uvicorn');
    if (/gunicorn\b/i.test(content)) techs.add('gunicorn');
    snap.framework = framework;
    snap.techStack = Array.from(techs);
    pushEvidence(snap, 'framework', pyproject ? 'pyproject.toml' : 'requirements.txt');

    // Entry point: main.py / app.py / server.py
    for (const c of ['app.py', 'main.py', 'server.py', 'manage.py', 'wsgi.py', 'asgi.py']) {
      if (exists(c)) {
        snap.entryPoint = `python ${c}`;
        pushEvidence(snap, 'entryPoint', c);
        break;
      }
    }
  }

  // ── go.mod → Go ────────────────────────────────────────────────────────
  const gomod = safeReadFile(projectPath, 'go.mod');
  if (gomod) {
    snap.language = 'go';
    snap.packageManager = 'go modules';
    snap.manifestFiles.push('go.mod');
    pushEvidence(snap, 'language', 'go.mod');
    pushEvidence(snap, 'packageManager', 'go.mod');
    const techs = new Set<string>(snap.techStack);
    let framework = UNKNOWN;
    if (/gin-gin\b|gin-contrib\b/.test(gomod)) { framework = 'Gin'; techs.add('Gin'); }
    else if (/labstack\/echo\b/.test(gomod)) { framework = 'Echo'; techs.add('Echo'); }
    else if (/fiber-go\b/.test(gomod)) { framework = 'Fiber'; techs.add('Fiber'); }
    else if (/gorilla\b/.test(gomod)) { framework = 'Gorilla'; techs.add('Gorilla'); }
    else if (/chi\b/.test(gomod)) { framework = 'chi'; techs.add('chi'); }
    snap.framework = framework;
    snap.techStack = Array.from(techs);
    if (exists('main.go')) {
      snap.entryPoint = 'go run .';
      pushEvidence(snap, 'entryPoint', 'main.go');
    }
  }

  // ── Cargo.toml → Rust ───────────────────────────────────────────────
  const cargo = safeReadFile(projectPath, 'Cargo.toml');
  if (cargo) {
    snap.language = 'rust';
    snap.packageManager = 'cargo';
    snap.manifestFiles.push('Cargo.toml');
    pushEvidence(snap, 'language', 'Cargo.toml');
    pushEvidence(snap, 'packageManager', 'Cargo.toml');
    const techs = new Set<string>(snap.techStack);
    let framework = UNKNOWN;
    if (/actix-web\b/.test(cargo)) { framework = 'Actix Web'; techs.add('Actix Web'); }
    else if (/axum\b/.test(cargo)) { framework = 'Axum'; techs.add('Axum'); }
    else if (/rocket\b/.test(cargo)) { framework = 'Rocket'; techs.add('Rocket'); }
    else if (/warp\b/.test(cargo)) { framework = 'Warp'; techs.add('Warp'); }
    else if (/tokio\b/.test(cargo)) { framework = 'Tokio'; techs.add('Tokio'); }
    snap.framework = framework;
    snap.techStack = Array.from(techs);
    if (exists('src/main.rs')) {
      snap.entryPoint = 'cargo run';
      pushEvidence(snap, 'entryPoint', 'src/main.rs');
    }
  }

  // ── Gemfile → Ruby ──────────────────────────────────────────────────
  const gemfile = safeReadFile(projectPath, 'Gemfile');
  if (gemfile) {
    snap.language = 'ruby';
    snap.packageManager = 'bundler';
    snap.manifestFiles.push('Gemfile');
    pushEvidence(snap, 'language', 'Gemfile');
    pushEvidence(snap, 'packageManager', 'Gemfile');
    let framework = UNKNOWN;
    if (/rails\b/.test(gemfile)) snap.framework = 'Ruby on Rails';
    else if (/sinatra\b/.test(gemfile)) snap.framework = 'Sinatra';
    else if (/hanami\b/.test(gemfile)) snap.framework = 'Hanami';
    pushEvidence(snap, 'framework', 'Gemfile');
    if (exists('config.ru')) {
      snap.entryPoint = 'bundle exec rails server';
      pushEvidence(snap, 'entryPoint', 'config.ru');
    }
  }

  // ── composer.json → PHP ──────────────────────────────────────────────
  const composer = safeReadFile(projectPath, 'composer.json');
  if (composer) {
    snap.language = 'php';
    snap.packageManager = 'composer';
    snap.manifestFiles.push('composer.json');
    pushEvidence(snap, 'language', 'composer.json');
    pushEvidence(snap, 'packageManager', 'composer.json');
    try {
      const cj = JSON.parse(composer);
      const req = { ...(cj.require || {}) };
      if ('laravel/framework' in req) snap.framework = 'Laravel';
      else if ('symfony/symfony' in req) snap.framework = 'Symfony';
      else if ('slim/slim' in req) snap.framework = 'Slim';
      pushEvidence(snap, 'framework', 'composer.json');
    } catch { snap.warnings.push('composer.json could not be parsed'); }
  }

  // ── Dockerfile / compose ──────────────────────────────────────────────
  if (exists('Dockerfile')) {
    snap.containerConfig.type = 'dockerfile';
    snap.manifestFiles.push('Dockerfile');
    pushEvidence(snap, 'containerConfig', 'Dockerfile');
    const dockerfile = safeReadFile(projectPath, 'Dockerfile') ?? '';
    const ports = parseDockerfilePorts(dockerfile);
    snap.containerConfig.ports.push(...ports);
    if (ports.length) pushEvidence(snap, 'ports', 'Dockerfile:EXPOSE');
  }
  const composePath = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
    .find((p) => exists(p));
  if (composePath) {
    snap.containerConfig.type = 'compose';
    snap.manifestFiles.push(composePath);
    pushEvidence(snap, 'containerConfig', composePath);
    const compose = safeReadFile(projectPath, composePath) ?? '';
    const ports = parseComposePorts(compose);
    snap.containerConfig.ports.push(...ports);
    if (ports.length) pushEvidence(snap, 'ports', composePath);
  }

  // ── .env.example → env vars ───────────────────────────────────────────
  const envExample = safeReadFile(projectPath, '.env.example');
  if (envExample) {
    snap.manifestFiles.push('.env.example');
    pushEvidence(snap, 'envVars', '.env.example');
    for (const line of envExample.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const name = m[1];
        let value: string | null = m[2].trim();
        if (/^(placeholder|changeme|your-.*|xxx+|.*example.*)$/i.test(value)) value = null;
        snap.envVars.push({ name, required: !value, defaultValue: value });
      }
    }
  }

  // ── Makefile ─────────────────────────────────────────────────────────
  const makefile = safeReadFile(projectPath, 'Makefile');
  if (makefile) {
    snap.manifestFiles.push('Makefile');
    pushEvidence(snap, 'techStack', 'Makefile');
    const targets = new Set<string>();
    for (const line of makefile.split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z0-9_\-]+)\s*:/);
      if (m) targets.add(m[1]);
    }
    if (targets.has('run') && snap.entryPoint === UNKNOWN) {
      snap.entryPoint = 'make run';
      pushEvidence(snap, 'entryPoint', 'Makefile:run');
    }
  }

  // ── README presence ────────────────────────────────────────────────────
  const readmeNames = ['README.md', 'README.rst', 'README.txt', 'README'];
  const readme = readmeNames.find((n) => exists(n));
  if (readme) {
    snap.manifestFiles.push(readme);
    pushEvidence(snap, 'readmePath', readme);
  }

  // ── directory probes ─────────────────────────────────────────────────
  const dirListing = listFiles(projectPath, '.', 200);
  for (const rel of dirListing) {
    if (/(^|\/)(src|app|lib|cmd|internal)\b/.test(rel)) {
      pushEvidence(snap, 'techStack', rel);
    }
  }

  // Dedupe ports.
  snap.ports = Array.from(new Set(snap.ports)).sort((a, b) => a - b);
  snap.containerConfig.ports = Array.from(new Set(snap.containerConfig.ports)).sort((a, b) => a - b);
  snap.manifestFiles = Array.from(new Set(snap.manifestFiles));

  return snap;
}

function pushEvidence(snap: DiscoverySnapshot, field: string, file: string) {
  if (!snap.evidence[field]) snap.evidence[field] = [];
  if (!snap.evidence[field].includes(file)) snap.evidence[field].push(file);
}

function detectNodePm(projectPath: string): string {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'bun.lockb')) || fs.existsSync(path.join(projectPath, 'bun.lock'))) return 'bun';
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
  return 'npm'; // default
}

function parseDockerfilePorts(s: string): number[] {
  const out: number[] = [];
  for (const line of s.split(/\r?\n/)) {
    const m = line.match(/^\s*EXPOSE\s+(\d{2,5})\b/i);
    if (m) out.push(Number(m[1]));
  }
  return out;
}

function parseComposePorts(s: string): number[] {
  const out: number[] = [];
  // Ports can be:
  //   - "3000:3000"
  //   - "3000"
  //   - 3000:3000
  //   - 3000
  for (const line of s.split(/\r?\n/)) {
    const m = line.match(/-\s*["']?(\d{2,5}):(\d{2,5})["']?/) ?? line.match(/-\s*["']?(\d{2,5})["']?/);
    if (m) {
      const host = Number(m[1]);
      const container = Number(m[2] ?? m[1]);
      out.push(host || container);
    }
  }
  return out;
}
