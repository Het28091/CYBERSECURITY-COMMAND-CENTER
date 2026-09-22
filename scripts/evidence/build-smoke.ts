#!/usr/bin/env bun
// Production build + start + smoke test + restart + persistence verification.
// Captures evidence to artifacts/tests/build-smoke.json and .md.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

const ARTIFACTS_DIR = '/home/z/my-project/artifacts/tests';
const PROD_LOG = '/home/z/my-project/prod.log';
const PORT = 3000;

fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

interface Step {
  name: string;
  command: string;
  timestamp: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  pass: boolean;
  notes?: string;
}

const steps: Step[] = [];

async function runStep(name: string, command: string, opts: { cwd?: string; timeout?: number; capture?: boolean } = {}): Promise<Step> {
  const step: Step = {
    name, command,
    timestamp: new Date().toISOString(),
    exitCode: -1, stdout: '', stderr: '', pass: false,
  };
  console.log(`\n--- ${name} ---`);
  console.log(`$ ${command}`);
  try {
    const result = await runCommand(command, opts);
    step.exitCode = result.exitCode;
    step.stdout = result.stdout.slice(0, 5000);
    step.stderr = result.stderr.slice(0, 5000);
    step.pass = result.exitCode === 0;
    console.log(`exit: ${result.exitCode}`);
    if (result.stdout) console.log(result.stdout.slice(0, 1000));
    if (result.stderr) console.error('stderr:', result.stderr.slice(0, 500));
  } catch (e) {
    step.exitCode = -1;
    step.stderr = (e as Error).message;
    step.pass = false;
    console.error('error:', step.stderr);
  }
  steps.push(step);
  return step;
}

function runCommand(command: string, opts: { cwd?: string; timeout?: number } = {}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('bash', ['-c', command], {
      cwd: opts.cwd ?? '/home/z/my-project',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => stdout += c.toString('utf8'));
    proc.stderr.on('data', (c) => stderr += c.toString('utf8'));
    const t = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
      resolve({ exitCode: 124, stdout, stderr: stderr + '\n[TIMEOUT]' });
    }, opts.timeout ?? 300000);
    proc.on('close', (code) => { clearTimeout(t); resolve({ exitCode: code ?? -1, stdout, stderr }); });
    proc.on('error', (e) => { clearTimeout(t); resolve({ exitCode: -1, stdout, stderr: stderr + e.message }); });
  });
}

async function http(url: string, opts: RequestInit = {}, cookies?: string): Promise<{ status: number; body: string }> {
  try {
    if (cookies) {
      const h = opts.headers ?? {};
      (h as any).Cookie = cookies;
      opts.headers = h;
    }
    const res = await fetch(url, opts);
    const body = await res.text();
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: (e as Error).message };
  }
}

function waitForServer(maxMs = 30000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/api/auth/session`, { signal: AbortSignal.timeout(2000) });
        if (r.status === 401 || r.status === 200) { resolve(true); return; }
      } catch {}
      if (Date.now() - start > maxMs) { resolve(false); return; }
      setTimeout(check, 500);
    };
    check();
  });
}

async function login(): Promise<string | null> {
  const r = await http(`http://127.0.0.1:${PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'changeme' }),
  });
  // Extract Set-Cookie
  const setCookie = r.headers ? '' : ''; // we'll do this via curl
  // Use a child curl to grab the cookie
  return new Promise((resolve) => {
    const proc = spawn('curl', ['-s', '-c', '/tmp/prod-cookie.txt', '-X', 'POST', `http://127.0.0.1:${PORT}/api/auth/login`, '-H', 'Content-Type: application/json', '-d', '{"username":"admin","password":"changeme"}'], { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.on('close', () => {
      try {
        const c = fs.readFileSync('/tmp/prod-cookie.txt', 'utf8');
        const m = c.match(/cybercc_session\s+(\S+)/);
        resolve(m ? `cybercc_session=${m[1]}` : null);
      } catch { resolve(null); }
    });
  });
}

async function main() {
  console.log('=== Production Build + Smoke Test ===\n');

  // Step 1: Install dependencies
  await runStep('Install dependencies', 'cd /home/z/my-project && bun install 2>&1 | tail -5', { timeout: 120000 });

  // Step 2: Database migrations (push schema)
  await runStep('Database push (migrations)', 'cd /home/z/my-project && bun run db:push 2>&1 | tail -5', { timeout: 60000 });

  // Step 3: Run lint (gate)
  await runStep('Lint (gate)', 'cd /home/z/my-project && bun run lint 2>&1 | tail -3', { timeout: 60000 });

  // Step 4: Build the production application
  await runStep('Production build', 'cd /home/z/my-project && bun run build 2>&1 | tail -10', { timeout: 600000 });

  // Step 5: Kill any existing process on port 3000
  await runStep('Kill existing processes on port 3000', `bash -c "ps aux | grep -E 'next dev|standalone/server' | grep -v grep | awk '{print \\\$2}' | xargs -r kill -9 2>/dev/null; sleep 1; echo done"`, { timeout: 10000 });

  // Step 6: Start the production server
  console.log('\n--- Start production server (background) ---');
  try { fs.unlinkSync(PROD_LOG); } catch {}
  const prodProc = spawn('bash', ['-c', `cd /home/z/my-project && NODE_ENV=production bun .next/standalone/server.js > ${PROD_LOG} 2>&1`], { stdio: 'ignore', detached: true });
  prodProc.unref();

  // Step 7: Wait for server to come up
  const up = await waitForServer(30000);
  const upStep: Step = {
    name: 'Wait for production server to come up',
    command: `wait for http://127.0.0.1:${PORT}/api/auth/session`,
    timestamp: new Date().toISOString(),
    exitCode: up ? 0 : 1, stdout: up ? 'server up' : 'timeout', stderr: '', pass: up,
  };
  steps.push(upStep);
  console.log(`Server up: ${up}`);

  // Step 8: Read prod.log (may be empty in standalone mode)
  const log = fs.existsSync(PROD_LOG) ? fs.readFileSync(PROD_LOG, 'utf8') : '';
  const logStep: Step = {
    name: 'Production server log',
    command: `cat ${PROD_LOG}`,
    timestamp: new Date().toISOString(),
    exitCode: 0, stdout: log.slice(0, 2000), stderr: '',
    pass: true, // standalone mode may write nothing to stdout; we verify via HTTP instead
    notes: log ? 'log present' : 'log empty (standalone mode) — verified via HTTP instead',
  };
  steps.push(logStep);

  // Step 9: Login
  const cookie = await login();
  const loginStep: Step = {
    name: 'Login as admin',
    command: 'curl -c /tmp/prod-cookie.txt -X POST /api/auth/login -d {"username":"admin","password":"changeme"}',
    timestamp: new Date().toISOString(),
    exitCode: cookie ? 0 : 1, stdout: cookie ?? 'no cookie', stderr: '', pass: !!cookie,
  };
  steps.push(loginStep);

  // Step 10: Run smoke tests against the production server
  const smokeTests: { name: string; url: string; method?: string; body?: any; expectedStatus: number }[] = [
    { name: 'Homepage', url: '/', expectedStatus: 200 },
    { name: 'Health', url: '/api/system/health', expectedStatus: 200 },
    { name: 'Projects list', url: '/api/projects?limit=10', expectedStatus: 200 },
    { name: 'OWASP entries', url: '/api/owasp', expectedStatus: 200 },
    { name: 'AI security entries', url: '/api/ai-security', expectedStatus: 200 },
    { name: 'Tools list', url: '/api/tools', expectedStatus: 200 },
    { name: 'Compliance frameworks', url: '/api/compliance', expectedStatus: 200 },
    { name: 'Audit events', url: '/api/audit?limit=5', expectedStatus: 200 },
    { name: 'Data sources', url: '/api/system/datasources', expectedStatus: 200 },
    { name: 'Scanners', url: '/api/scanners', expectedStatus: 200 },
    { name: 'Search', url: '/api/search?q=test', expectedStatus: 200 },
    { name: 'Threat feeds', url: '/api/threat-intel/feeds', expectedStatus: 200 },
    { name: 'Threat indicators', url: '/api/threat-intel/indicators?limit=5', expectedStatus: 200 },
    { name: 'Verify list', url: '/api/verify/list', expectedStatus: 200 },
    { name: 'Settings (admin)', url: '/api/settings', expectedStatus: 200 },
    { name: 'Unauthenticated GET (should 401)', url: '/api/projects?limit=1', expectedStatus: 401 },
  ];

  let smokePass = 0;
  let smokeFail = 0;
  for (const t of smokeTests) {
    const opts: RequestInit = t.body ? { method: t.method ?? 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t.body) } : {};
    if (cookie && t.name !== 'Unauthenticated GET (should 401)') (opts.headers as any) = { ...(opts.headers as any || {}), Cookie: cookie };
    const r = await http(`http://127.0.0.1:${PORT}${t.url}`, opts);
    const pass = r.status === t.expectedStatus;
    if (pass) smokePass++; else smokeFail++;
    steps.push({
      name: `Smoke: ${t.name}`,
      command: `curl -X ${t.method ?? 'GET'} ${t.url} (expected ${t.expectedStatus})`,
      timestamp: new Date().toISOString(),
      exitCode: r.status, stdout: r.body.slice(0, 500), stderr: '', pass,
      notes: `HTTP ${r.status} expected ${t.expectedStatus}`,
    });
    console.log(`${pass ? '✓' : '✗'} ${t.name}: ${r.status} (expected ${t.expectedStatus})`);
  }

  // Step 11: Database persistence test
  // Register a project, kill the server, restart, verify the project still exists.
  console.log('\n--- Persistence test ---');
  // Use a unique path so the project is actually created.
  const persistPath = '/tmp/cybercc-persist-' + Date.now();
  try { fs.mkdirSync(persistPath, { recursive: true }); fs.writeFileSync(path.join(persistPath, 'marker'), 'test'); } catch {}
  const persistSetup = await http(`http://127.0.0.1:${PORT}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie ?? '' },
    body: JSON.stringify({ name: 'persistence-test-' + Date.now(), localPath: persistPath }),
  });
  const persistSetupData = JSON.parse(persistSetup.body);
  const persistProjectId = persistSetupData.data?.id;
  const persistProjectName = persistSetupData.data?.name;
  console.log(`Created project ${persistProjectName} (id ${persistProjectId}) — HTTP ${persistSetup.status}`);
  if (!persistProjectId) {
    steps.push({
      name: 'Persistence: setup',
      command: 'POST /api/projects', timestamp: new Date().toISOString(),
      exitCode: persistSetup.status, stdout: persistSetup.body.slice(0, 500), stderr: '', pass: false,
      notes: 'Setup failed — cannot run persistence test',
    });
  }

  // Kill the server
  await runStep('Kill production server (for persistence test)', `bash -c "ps aux | grep 'standalone/server' | grep -v grep | awk '{print \\\$2}' | xargs -r kill -9; sleep 2; echo killed"`, { timeout: 10000 });

  // Restart
  console.log('\n--- Restart production server ---');
  try { fs.unlinkSync(PROD_LOG); } catch {}
  const prodProc2 = spawn('bash', ['-c', `cd /home/z/my-project && NODE_ENV=production bun .next/standalone/server.js > ${PROD_LOG} 2>&1`], { stdio: 'ignore', detached: true });
  prodProc2.unref();

  const up2 = await waitForServer(30000);
  steps.push({
    name: 'Restart production server',
    command: 'wait for restart', timestamp: new Date().toISOString(),
    exitCode: up2 ? 0 : 1, stdout: up2 ? 'restarted' : 'failed', stderr: '', pass: up2,
  });

  // Wait a bit more for the server to fully initialize
  await new Promise((r) => setTimeout(r, 2000));

  // Re-login
  const cookie2 = await login();
  // Wait a bit more for the cookie to take effect
  await new Promise((r) => setTimeout(r, 500));
  // Verify the project still exists
  const r = await http(`http://127.0.0.1:${PORT}/api/projects?limit=200`, { headers: { Cookie: cookie2 ?? '' } });
  const rData = JSON.parse(r.body);
  const found = (rData.data ?? []).some((p: any) => p.id === persistProjectId);
  steps.push({
    name: 'Persistence: project survived restart',
    command: `curl ${PORT}/api/projects?q=${persistProjectName}`,
    timestamp: new Date().toISOString(),
    exitCode: r.status, stdout: r.body.slice(0, 500), stderr: '', pass: found,
    notes: found ? `Project ${persistProjectId} found after restart` : 'PROJECT LOST',
  });

  // Step 12: Clean shutdown
  console.log('\n--- Clean shutdown ---');
  await runStep('Kill production server cleanly', `bash -c "ps aux | grep 'standalone/server' | grep -v grep | awk '{print \\\$2}' | xargs -r kill; sleep 2; echo done"`, { timeout: 10000 });

  // Step 13: Restart again and verify it still comes up
  console.log('\n--- Final restart ---');
  try { fs.unlinkSync(PROD_LOG); } catch {}
  const prodProc3 = spawn('bash', ['-c', `cd /home/z/my-project && NODE_ENV=production bun .next/standalone/server.js > ${PROD_LOG} 2>&1`], { stdio: 'ignore', detached: true });
  prodProc3.unref();
  const up3 = await waitForServer(30000);
  steps.push({
    name: 'Final restart after shutdown',
    command: 'wait for restart', timestamp: new Date().toISOString(),
    exitCode: up3 ? 0 : 1, stdout: up3 ? 'restarted' : 'failed', stderr: '', pass: up3,
  });

  // Cleanup: kill the prod server so dev server can run
  await runStep('Final cleanup (kill prod server)', `bash -c "ps aux | grep 'standalone/server' | grep -v grep | awk '{print \\\$2}' | xargs -r kill -9; sleep 1; echo cleaned"`, { timeout: 10000 });

  // Restart the dev server so the user's preview keeps working
  console.log('\n--- Restart dev server for preview ---');
  spawn('bash', ['-c', 'cd /home/z/my-project && nohup ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 &'], { stdio: 'ignore', detached: true }).unref();
  await new Promise((r) => setTimeout(r, 5000));

  // ─── Write artifacts ────────────────────────────────────────────────────
  const passed = steps.filter((s) => s.pass).length;
  const failed = steps.filter((s) => !s.pass).length;

  const jsonReport = {
    timestamp: new Date().toISOString(),
    totalSteps: steps.length,
    passed,
    failed,
    smokeTestsPassed: smokePass,
    smokeTestsFailed: smokeFail,
    steps,
  };
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'build-smoke.json'), JSON.stringify(jsonReport, null, 2));

  const mdLines = [
    '# Production Build + Smoke Test Results',
    '',
    `**Timestamp:** ${new Date().toISOString()}`,
    `**Total steps:** ${steps.length}`,
    `**Passed:** ${passed}`,
    `**Failed:** ${failed}`,
    `**Smoke tests passed:** ${smokePass}`,
    `**Smoke tests failed:** ${smokeFail}`,
    '',
    '## Steps',
    '',
    '| # | Name | Pass | Exit Code | Notes |',
    '|---|---|---|---|---|',
  ];
  steps.forEach((s, i) => {
    mdLines.push(`| ${i + 1} | ${s.name.replace(/\|/g, '\\|')} | ${s.pass ? '✓' : '✗'} | ${s.exitCode} | ${(s.notes ?? '').replace(/\|/g, '\\|')} |`);
  });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'build-smoke.md'), mdLines.join('\n'));

  console.log(`\n=== Summary ===`);
  console.log(`Total steps: ${steps.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Smoke tests: ${smokePass}/${smokePass + smokeFail}`);
  console.log(`\nArtifacts:`);
  console.log(`  ${path.join(ARTIFACTS_DIR, 'build-smoke.json')}`);
  console.log(`  ${path.join(ARTIFACTS_DIR, 'build-smoke.md')}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
