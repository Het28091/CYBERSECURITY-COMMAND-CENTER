#!/usr/bin/env bun
// AUTH-SESSION-REVOCATION-001 — Stolen-cookie replay regression test.
//
// This test MUST fail against the old implementation (stateless HMAC cookie
// with no server-side revocation) and pass against the new implementation
// (DB-backed session with revocation).
//
// Test flow:
// 1. Login → capture the original cookie.
// 2. Confirm the cookie works (authenticated request → 200).
// 3. Logout normally.
// 4. Reuse the original cookie manually.
// 5. Attempt a protected API request.
// 6. Verify HTTP 401 (rejected — session revoked server-side).
// 7. Verify the old session cannot be renewed.
//
// Also tests:
// - Expired cookie (manipulate expiry) → rejected
// - Malformed cookie → rejected
// - Modified cookie (tampered signature) → rejected
// - Concurrent sessions (two logins → both work → logout one → other still works)
// - Session replay after password change (not applicable yet — single env-var password)

import * as fs from 'node:fs';

const SERVER = 'http://127.0.0.1:3000';
const COOKIE_FILE = '/tmp/auth-session-revocation-test.txt';

interface TestResult {
  id: string;
  description: string;
  passed: boolean;
  details: string;
  httpStatus?: number;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;

function record(id: string, description: string, passed: boolean, details: string, httpStatus?: number): void {
  results.push({ id, description, passed, details, httpStatus });
  if (passed) passCount++; else failCount++;
  console.log(`${passed ? '✓ PASS' : '✗ FAIL'} [${id}] ${description}`);
  if (details) console.log(`    ${details}`);
  if (httpStatus) console.log(`    HTTP ${httpStatus}`);
}

async function fetchWithCookie(url: string, cookie: string, method = 'GET', body?: any): Promise<{ status: number; body: string }> {
  try {
    const opts: RequestInit = { method, headers: { Cookie: cookie } };
    if (body) {
      (opts.headers as any)['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${SERVER}${url}`, opts);
    const text = await res.text();
    return { status: res.status, body: text };
  } catch (e) {
    return { status: 0, body: (e as Error).message };
  }
}

function extractCookie(cookieFile: string): string {
  try {
    const c = fs.readFileSync(cookieFile, 'utf8');
    const m = c.match(/cybercc_session\s+(\S+)/);
    return m ? `cybercc_session=${m[1]}` : '';
  } catch { return ''; }
}

async function login(): Promise<string> {
  // Use fetch directly so we can capture the Set-Cookie header
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'changeme' }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/cybercc_session=([^;]+)/);
  return m ? `cybercc_session=${m[1]}` : '';
}

async function logout(cookie: string): Promise<number> {
  const res = await fetch(`${SERVER}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
  return res.status;
}

async function main() {
  console.log('=== AUTH-SESSION-REVOCATION-001: Stolen-Cookie Replay Test ===\n');
  console.log(`Server: ${SERVER}\n`);

  // ── Test 1: Normal logout invalidates session ────────────────────────────
  console.log('--- Test 1: Normal logout invalidates session ---');
  const cookie1 = await login();
  record('SETUP-1', 'Login succeeds and returns a cookie', cookie1 !== '', cookie1 ? 'cookie captured' : 'no cookie returned');
  if (!cookie1) { console.log('Cannot proceed — login failed'); process.exit(1); }

  // Confirm cookie works
  const authedRes = await fetchWithCookie('/api/projects?limit=1', cookie1);
  record('REV-001', 'Authenticated request works with valid cookie', authedRes.status === 200, `Expected 200`, authedRes.status);

  // Logout
  const logoutStatus = await logout(cookie1);
  record('REV-002', 'Logout succeeds', logoutStatus === 200, `Expected 200`, logoutStatus);

  // Replay the old cookie
  const replayRes = await fetchWithCookie('/api/projects?limit=1', cookie1);
  record('REV-003', 'OLD COOKIE REJECTED after logout (F-001 fix)', replayRes.status === 401, `Expected 401 — old cookie must be rejected after logout`, replayRes.status);

  // ── Test 2: Stolen cookie replay ──────────────────────────────────────────
  console.log('\n--- Test 2: Stolen cookie replay (simulates attacker) ---');
  const cookie2 = await login();
  record('SETUP-2', 'Attacker steals a cookie', cookie2 !== '', 'cookie captured');

  // Attacker uses the stolen cookie
  const attackRes = await fetchWithCookie('/api/projects?limit=1', cookie2);
  record('REV-004', 'Stolen cookie works BEFORE logout (expected)', attackRes.status === 200, `Expected 200 — cookie is valid`, attackRes.status);

  // Legitimate user logs out
  const logoutStatus2 = await logout(cookie2);
  record('REV-005', 'Legitimate user logs out', logoutStatus2 === 200, `Expected 200`, logoutStatus2);

  // Attacker tries the stolen cookie AGAIN after logout
  const replayAttackRes = await fetchWithCookie('/api/projects?limit=1', cookie2);
  record('REV-006', 'STOLEN COOKIE REJECTED after logout (F-001 fix)', replayAttackRes.status === 401, `Expected 401 — stolen cookie must be rejected after logout`, replayAttackRes.status);

  // ── Test 3: Expired cookie ────────────────────────────────────────────────
  console.log('\n--- Test 3: Expired cookie (manipulate expiry) ---');
  const cookie3 = await login();
  // Decode the cookie, change the expiry to the past, re-sign with the same secret.
  // We can't re-sign without the secret, but we CAN test with a cookie that has
  // an expired payload — the HMAC check will fail if we modify it, so this tests
  // both tamper detection and expiry. A properly expired session (after 8h) would
  // be rejected by the payload expiry check.
  // For this test, we create a cookie, then manually wait for it to expire is not
  // practical (8h). Instead, we test that a cookie with a manipulated expiry is
  // rejected (tamper detection). A real expired session would also be rejected
  // by the DB expiry check.
  const tamperedCookie = cookie3.replace(/cybercc_session=([^;]+)/, (_, v) => {
    // Try to modify the cookie value — the HMAC will fail
    return `cybercc_session=${v}TAMPERED`;
  });
  const expiredRes = await fetchWithCookie('/api/projects?limit=1', tamperedCookie);
  record('REV-007', 'Tampered cookie rejected (HMAC integrity)', expiredRes.status === 401, `Expected 401 — tampered cookie must fail HMAC check`, expiredRes.status);

  // ── Test 4: Malformed cookie ─────────────────────────────────────────────
  console.log('\n--- Test 4: Malformed cookie ---');
  const malformedRes = await fetchWithCookie('/api/projects?limit=1', 'cybercc_session=not-a-valid-cookie');
  record('REV-008', 'Malformed cookie rejected', malformedRes.status === 401, `Expected 401`, malformedRes.status);

  // ── Test 5: No cookie ────────────────────────────────────────────────────
  console.log('\n--- Test 5: No cookie ---');
  const noCookieRes = await fetchWithCookie('/api/projects?limit=1', '');
  record('REV-009', 'No cookie rejected', noCookieRes.status === 401, `Expected 401`, noCookieRes.status);

  // ── Test 6: Concurrent sessions ─────────────────────────────────────────
  console.log('\n--- Test 6: Concurrent sessions ---');
  const cookieA = await login();
  const cookieB = await login();
  const aRes = await fetchWithCookie('/api/projects?limit=1', cookieA);
  const bRes = await fetchWithCookie('/api/projects?limit=1', cookieB);
  record('REV-010', 'Concurrent sessions both work', aRes.status === 200 && bRes.status === 200, `Both sessions should be valid`, aRes.status);

  // Logout session A
  await logout(cookieA);
  const aReplay = await fetchWithCookie('/api/projects?limit=1', cookieA);
  record('REV-011', 'Logged-out session A rejected', aReplay.status === 401, `Expected 401 — session A revoked`, aReplay.status);

  // Session B should still work
  const bStillWorks = await fetchWithCookie('/api/projects?limit=1', cookieB);
  record('REV-012', 'Other session B still works after A logout', bStillWorks.status === 200, `Expected 200 — session B not revoked`, bStillWorks.status);

  // Cleanup: logout session B
  await logout(cookieB);

  // ── Test 7: New login after logout ──────────────────────────────────────
  console.log('\n--- Test 7: New login after logout ---');
  const newCookie = await login();
  const newRes = await fetchWithCookie('/api/projects?limit=1', newCookie);
  record('REV-013', 'New login after logout works', newRes.status === 200, `Expected 200 — fresh session`, newRes.status);
  await logout(newCookie);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n=== Summary ===');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  // Write artifacts
  const artifactDir = '/home/z/my-project/artifacts/tests';
  fs.mkdirSync(artifactDir, { recursive: true });
  const jsonOut = {
    testId: 'AUTH-SESSION-REVOCATION-001',
    timestamp: new Date().toISOString(),
    server: SERVER,
    total: results.length,
    passed: passCount,
    failed: failCount,
    results,
    f001Status: failCount === 0 ? 'FIXED' : 'NOT_FIXED',
  };
  fs.writeFileSync(`${artifactDir}/auth-session-revocation.json`, JSON.stringify(jsonOut, null, 2));

  const mdLines = [
    '# AUTH-SESSION-REVOCATION-001 — Stolen-Cookie Replay Test',
    '',
    `**Timestamp:** ${jsonOut.timestamp}`,
    `**Server:** ${jsonOut.server}`,
    `**F-001 Status:** ${jsonOut.f001Status}`,
    `**Total:** ${results.length}`,
    `**Passed:** ${passCount}`,
    `**Failed:** ${failCount}`,
    '',
    '| ID | Description | Pass | HTTP | Details |',
    '|---|---|---|---|---|',
    ...results.map(r => `| ${r.id} | ${r.description} | ${r.passed ? '✓' : '✗'} | ${r.httpStatus ?? '-'} | ${r.details} |`),
  ];
  fs.writeFileSync(`${artifactDir}/auth-session-revocation.md`, mdLines.join('\n'));

  console.log(`\nArtifacts:`);
  console.log(`  ${artifactDir}/auth-session-revocation.json`);
  console.log(`  ${artifactDir}/auth-session-revocation.md`);

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
