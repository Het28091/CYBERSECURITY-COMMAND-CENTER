// Authentication and authorization.
//
// Spiral 21 — F-001 fix: Server-side session revocation.
//
// Root cause: The previous implementation used stateless HMAC-signed cookies
// with no server-side state. Logout only cleared the client cookie. A stolen
// cookie remained valid for up to 8 hours (SESSION_TTL_MS).
//
// Fix: Each login now creates a DB `Session` row. getSession checks BOTH
// the HMAC signature AND the DB for a non-revoked, non-expired row. Logout
// marks the row as revoked. A stolen cookie becomes unusable because its
// DB row is revoked.
//
// Additional hardening:
// - Password hashing upgraded from FNV-1a (not crypto-secure) to scrypt
//   (Node.js built-in, stronger than bcrypt).
// - Cookie attributes: HttpOnly, SameSite=Strict, Secure (when HTTPS).
// - Session rotation: each login creates a new session (old ones remain
//   valid until revoked or expired — this is deliberate for concurrent
//   sessions; document the tradeoff).

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as crypto from 'node:crypto';

export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthConfig {
  disabled: boolean;
  localRole: Role;
}

// ─── Configuration ──────────────────────────────────────────────────────────

function readEnv(name: string): string | undefined {
  try { return process.env[name]; } catch { return undefined; }
}

export function getAuthConfig(): AuthConfig {
  const disabled = readEnv('AUTH_DISABLED') === 'true';
  const roleEnv = (readEnv('AUTH_LOCAL_ROLE') ?? 'ADMIN').toUpperCase() as Role;
  const role: Role = ['ADMIN', 'OPERATOR', 'VIEWER'].includes(roleEnv) ? roleEnv : 'ADMIN';
  return { disabled, localRole: role };
}

// ─── Password hashing (scrypt) ──────────────────────────────────────────────
// Replaces FNV-1a (which was not cryptographically secure).
// scrypt is a modern password-based key derivation function, built into
// Node.js via node:crypto. It's stronger than bcrypt against GPU/ASIC
// attacks due to its memory-hardness.

const SCRYPT_N = 16384; // CPU/memory cost — 2^14
const SCRYPT_R = 8;     // block size
const SCRYPT_P = 1;     // parallelization
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = parseInt(parts[1]);
  const r = parseInt(parts[2]);
  const p = parseInt(parts[3]);
  const salt = Buffer.from(parts[4], 'base64');
  const expectedHash = Buffer.from(parts[5], 'base64');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N, r, p });
  return crypto.timingSafeEqual(hash, expectedHash);
}

// ─── Credentials ────────────────────────────────────────────────────────────

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'changeme';

// Cache the hash so we don't re-hash on every request.
let cachedPasswordHash: string | null = null;

function getStoredCredentials(): { username: string; passwordHash: string; role: Role } {
  const username = readEnv('AUTH_USERNAME') ?? DEFAULT_ADMIN_USERNAME;
  const password = readEnv('AUTH_PASSWORD') ?? DEFAULT_ADMIN_PASSWORD;
  if (!cachedPasswordHash) {
    cachedPasswordHash = hashPassword(password);
  }
  return { username, passwordHash: cachedPasswordHash, role: 'ADMIN' };
}

/**
 * Get credentials from DB (UserPassword table) if available, else fall back
 * to env-var credentials. This allows password change via API without restart.
 */
async function getActiveCredentials(): Promise<{ username: string; passwordHash: string; role: Role }> {
  try {
    const dbCreds = await db.userPassword.findUnique({ where: { id: 1 } });
    if (dbCreds) {
      return { username: dbCreds.username, passwordHash: dbCreds.passwordHash, role: dbCreds.role as Role };
    }
  } catch { /* DB may not be ready yet — fall back to env */ }
  return getStoredCredentials();
}

/**
 * Change the password. Requires the current password to be verified first.
 * After password change, ALL existing sessions are revoked (the caller must
 * re-authenticate). The new password hash is stored in the DB.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; reason?: string }> {
  const creds = await getActiveCredentials();
  if (!verifyPassword(currentPassword, creds.passwordHash)) {
    return { ok: false, reason: 'Current password is incorrect' };
  }

  // Validate new password strength
  const validation = validatePasswordStrength(newPassword);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  const newHash = hashPassword(newPassword);
  const username = creds.username;
  const role = creds.role;

  // Upsert the DB row
  try {
    await db.userPassword.upsert({
      where: { id: 1 },
      update: { passwordHash: newHash, role },
      create: { id: 1, username, passwordHash: newHash, role },
    });
  } catch (e) {
    return { ok: false, reason: `Failed to store password: ${(e as Error).message}` };
  }

  // Invalidate the cached hash so the new password takes effect immediately.
  cachedPasswordHash = null;

  // Revoke ALL existing sessions (force re-login everywhere).
  try {
    await db.session.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch { /* non-fatal — sessions may still expire naturally */ }

  return { ok: true };
}

/**
 * Validate password strength. Local-first appropriate: minimum 8 chars,
 * at least one letter and one number. Not overly complex for a local tool.
 */
export function validatePasswordStrength(password: string): { ok: boolean; reason?: string } {
  if (password.length < 8) return { ok: false, reason: 'Password must be at least 8 characters' };
  if (!/[a-zA-Z]/.test(password)) return { ok: false, reason: 'Password must contain at least one letter' };
  if (!/[0-9]/.test(password)) return { ok: false, reason: 'Password must contain at least one number' };
  if (password.length > 200) return { ok: false, reason: 'Password too long (max 200 characters)' };
  return { ok: true };
}

// ─── Login Rate Limiting ───────────────────────────────────────────────────
// Tracks failed login attempts by username. After MAX_FAILED_ATTEMPTS,
// the account is temporarily locked for LOCKOUT_DURATION_MS.
// This is in-memory (not DB-backed) — appropriate for local-first single-user.

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 1 minute
const FAILED_ATTEMPT_RESET_MS = 15 * 60 * 1000; // reset after 15 min of no attempts

interface FailedAttempt {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
}
const failedAttempts = new Map<string, FailedAttempt>();

function checkLoginAllowed(username: string): { allowed: boolean; reason?: string } {
  const entry = failedAttempts.get(username);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil > Date.now()) {
    const secondsLeft = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return { allowed: false, reason: `Account temporarily locked. Try again in ${secondsLeft}s.` };
  }
  // Reset if enough time has passed
  if (Date.now() - entry.firstAttemptAt > FAILED_ATTEMPT_RESET_MS) {
    failedAttempts.delete(username);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedLogin(username: string): void {
  const entry = failedAttempts.get(username) ?? { count: 0, firstAttemptAt: Date.now(), lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  failedAttempts.set(username, entry);
}

function recordSuccessfulLogin(username: string): void {
  failedAttempts.delete(username);
}

// ─── Session (DB-backed) ─────────────────────────────────────────────────────

const SESSION_COOKIE = 'cybercc_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function getAuthSecret(): string {
  return readEnv('AUTH_SECRET') ?? `cybercc-local-${process.env.DATABASE_URL ?? 'default'}`;
}

function sign(payload: string): string {
  const secret = getAuthSecret();
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySignature(signed: string): string | null {
  if (!signed || !signed.includes('.')) return null;
  const lastDot = signed.lastIndexOf('.');
  const payload = signed.slice(0, lastDot);
  const sig = signed.slice(lastDot + 1);
  const expected = sign(payload);
  const expectedSig = expected.slice(expected.lastIndexOf('.') + 1);
  // Timing-safe comparison
  if (sig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return payload;
  }
  return null;
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

interface SessionPayload {
  sid: string;       // session ID (cuid) — stored in DB
  id: string;        // user ID
  name: string;
  email: string;
  role: Role;
  exp: number;       // expiry timestamp (ms)
}

/**
 * Create a new session. Generates a signed cookie value AND persists a
 * Session row in the DB. The cookie value contains the session ID (sid)
 * which is used to look up the DB row on every authenticated request.
 */
export async function createSession(user: AuthUser): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const sid = crypto.randomUUID();
  const payload: SessionPayload = {
    sid, id: user.id, name: user.name, email: user.email, role: user.role, exp: expiresAt,
  };
  const signed = sign(Buffer.from(JSON.stringify(payload)).toString('base64url'));

  // Persist the session in the DB.
  await db.session.create({
    data: {
      id: sid,
      tokenHash: sha256(signed),
      userId: user.id,
      role: user.role,
      expiresAt: new Date(expiresAt),
    },
  });

  return signed;
}

/**
 * Get the current session from a request. Checks:
 * 1. Cookie exists.
 * 2. HMAC signature is valid (cookie not tampered).
 * 3. Session not expired (from payload).
 * 4. DB row exists and is not revoked.
 * 5. DB row not expired.
 *
 * If any check fails, returns null (unauthenticated).
 */
export async function getSession(req: NextRequest): Promise<AuthUser | null> {
  const config = getAuthConfig();
  if (config.disabled) {
    return { id: 'local-user', name: 'Local User', email: 'local@cybercc', role: config.localRole };
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  // Step 1: verify HMAC signature
  const payloadB64 = verifySignature(cookie);
  if (!payloadB64) return null;

  // Step 2: parse payload
  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  // Step 3: check expiry from payload
  if (payload.exp && payload.exp < Date.now()) return null;

  // Step 4: check DB for non-revoked, non-expired session
  const session = await db.session.findUnique({ where: { tokenHash: sha256(cookie) } });
  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt < new Date()) return null;

  // Return the user from the session
  return {
    id: payload.id,
    name: payload.name,
    email: payload.email,
    role: payload.role as Role,
  };
}

/**
 * Revoke a session server-side. Marks the DB row as revoked.
 * After this, any request with the old cookie will fail getSession.
 */
export async function revokeSession(req: NextRequest): Promise<void> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return;
  const tokenHash = sha256(cookie);
  try {
    await db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch { /* ignore — session may not exist */ }
}

/**
 * Clean up expired or revoked sessions (housekeeping).
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    // Delete sessions that are both expired AND revoked (older than 7 days).
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await db.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() }, revokedAt: { not: null } },
          { expiresAt: { lt: cutoff } },
        ],
      },
    });
  } catch { /* ignore */ }
}

export async function login(username: string, password: string): Promise<{ user: AuthUser | null; lockedReason?: string }> {
  const config = getAuthConfig();
  if (config.disabled) {
    return { user: { id: 'local-user', name: 'Local User', email: 'local@cybercc', role: config.localRole } };
  }
  // Check rate limiting
  const lockCheck = checkLoginAllowed(username);
  if (!lockCheck.allowed) {
    return { user: null, lockedReason: lockCheck.reason };
  }
  const stored = await getActiveCredentials();
  if (username !== stored.username) {
    recordFailedLogin(username);
    return { user: null };
  }
  if (!verifyPassword(password, stored.passwordHash)) {
    recordFailedLogin(username);
    return { user: null };
  }
  recordSuccessfulLogin(username);
  return { user: { id: 'admin', name: username, email: `${username}@cybercc.local`, role: stored.role } };
}

export function setSessionCookie(res: Response, sessionToken: string): void {
  const isHttps = readEnv('AUTH_COOKIE_SECURE') === 'true' || process.env.NODE_ENV === 'production';
  const secure = isHttps ? '; Secure' : '';
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

export function clearSessionCookie(res: Response): void {
  res.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

// ─── Authorization ────────────────────────────────────────────────────────────

export type Action = 'read' | 'create' | 'update' | 'delete' | 'run' | 'stop' | 'scan' | 'admin';

const ROLE_PERMISSIONS: Record<Role, Set<Action>> = {
  ADMIN: new Set<Action>(['read', 'create', 'update', 'delete', 'run', 'stop', 'scan', 'admin']),
  OPERATOR: new Set<Action>(['read', 'create', 'update', 'run', 'stop', 'scan']),
  VIEWER: new Set<Action>(['read']),
};

export function can(user: AuthUser | null, action: Action): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].has(action);
}

export interface AuthGateResult {
  ok: boolean;
  user: AuthUser | null;
  response?: ReturnType<typeof NextResponse.json>;
}

export async function requireAuth(req: NextRequest, action: Action): Promise<AuthGateResult> {
  const user = await getSession(req);
  if (!user) {
    return {
      ok: false,
      user: null,
      response: NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 }),
    };
  }
  if (!can(user, action)) {
    return {
      ok: false,
      user,
      response: NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: `Role ${user.role} cannot perform ${action}` } }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
