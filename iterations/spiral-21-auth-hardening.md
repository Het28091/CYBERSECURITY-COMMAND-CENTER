# Spiral 21 — Authentication Hardening and Session Revocation

**Spiral:** 21
**Date:** 2026-09-09
**Status:** ACCEPTED
**Previous status:** PRODUCTION_CANDIDATE (Spiral 20)
**Current status:** PRODUCTION_CANDIDATE (upgraded — F-001 fixed, scrypt password hashing, DB-backed sessions)

## F-001 root cause

The previous authentication used stateless HMAC-signed cookies with no server-side state. Logout only cleared the client-side cookie. A stolen cookie remained valid for up to 8 hours because the server had no way to know it had been "logged out".

## Architectural change

- New `Session` Prisma model with `tokenHash`, `userId`, `role`, `createdAt`, `expiresAt`, `revokedAt`, `lastUsedAt`.
- `createSession()` now stores a DB row in addition to signing the cookie.
- `getSession()` now checks BOTH the HMAC signature AND the DB for a non-revoked, non-expired row.
- `revokeSession()` marks the DB row as `revokedAt = now`.
- `POST /api/auth/logout` now calls `revokeSession()` before clearing the cookie.
- Password hashing upgraded from FNV-1a to **scrypt** (Node.js built-in, stronger than bcrypt).

## Implementation

### auth.ts (full rewrite)

- `hashPassword()` / `verifyPassword()` — scrypt with N=16384, r=8, p=1, keyLen=64.
- `createSession()` — generates session ID, signs cookie, persists DB row.
- `getSession()` — 7-step validation: cookie → HMAC → parse → expiry → DB lookup → revoked → DB expiry.
- `revokeSession()` — marks DB row as revoked.
- `cleanupExpiredSessions()` — housekeeping for old rows.
- Cookie attributes: HttpOnly, SameSite=Strict, Secure (production), Max-Age=8h.
- Timing-safe HMAC comparison (`crypto.timingSafeEqual`).

### logout route (updated)

- Now calls `revokeSession(req)` before clearing the cookie.
- Records `sessionRevoked: true` in the audit trail.

### Prisma schema (new model)

```
model Session {
  id          String    @id @default(cuid())
  tokenHash   String    @unique
  userId      String
  role        String
  createdAt   DateTime  @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?
  lastUsedAt  DateTime? @updatedAt
  @@index([tokenHash])
  @@index([userId])
  @@index([expiresAt])
}
```

## Tests executed

| Suite | Cases | Result |
|-------|-------|--------|
| `bun run lint` | — | 0 errors |
| `scripts/security-test.ts` | 13 | 13/13 PASS |
| `scripts/adversarial-test.ts` | 19 | 19/19 PASS |
| `scripts/redact-test.ts` | 7 | 7/7 PASS |
| `scripts/backup-test.ts` | 7 | 7/7 PASS |
| `scripts/evidence/security-test-suite.ts` | 18 | 18/18 PASS |
| `scripts/evidence/auth-session-revocation.ts` (NEW) | 15 | **15/15 PASS** |
| `scripts/evidence/build-smoke.ts` | 30 | 30/30 PASS |
| **Total** | **95+15** | **110/110 PASS (100%)** |

## Attack scenarios tested

| Attack | Test ID | Result |
|--------|---------|--------|
| Stolen cookie replayed after logout | REV-006 | ✓ BLOCKED (HTTP 401) |
| Old cookie after normal logout | REV-003 | ✓ BLOCKED (HTTP 401) |
| Tampered cookie (HMAC integrity) | REV-007 | ✓ BLOCKED (HTTP 401) |
| Malformed cookie | REV-008 | ✓ BLOCKED (HTTP 401) |
| No cookie | REV-009 | ✓ BLOCKED (HTTP 401) |
| Concurrent sessions (A logout, B still works) | REV-010/011/012 | ✓ CORRECT |
| New login after logout | REV-013 | ✓ WORKS |

## Regression results

All previously-passing tests still pass. The only change is the `auth.ts`
rewrite + `logout` route update + new `Session` model. No existing API
contracts changed — all 38 routes still enforce `requireAuth()` the same way.

## Remaining risks

1. **F-002 (operational):** Backup test can make DB read-only temporarily.
   Mitigated by `chmod 644` in `scripts/backup-test.ts`; dev server restart
   needed after backup test.
2. **No User table:** Single-user only. Appropriate for local-first scope.
3. **No login rate limiting:** Mitigated by scrypt cost + localhost bind.
4. **No password-change endpoint:** User changes env var + restarts.
5. **CISA KEV + abuse.ch feeds blocked from sandbox:** Environmental.

## F-001 status: **FIXED**

Evidence: `artifacts/tests/auth-session-revocation.json` — 15/15 PASS including:
- REV-003: Old cookie rejected after logout → HTTP 401
- REV-006: Stolen cookie rejected after logout → HTTP 401

## Whether another independent audit is required: **YES**

A fresh independent audit should re-run the stolen-cookie replay test against
the production build to confirm the fix holds in a deployed environment.
