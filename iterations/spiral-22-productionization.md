# Spiral 22 — Productionization, CI, Password Management, and GitHub Release

**Spiral:** 22
**Date:** 2026-09-09
**Status:** ACCEPTED
**Previous status:** PRODUCTION_CANDIDATE (Spiral 21)
**Current status:** PRODUCTION_CANDIDATE (upgraded — password change, login rate limiting, F-002 fixed, CI, configurable paths)

## Implementation

### Password Management (section 3)
- New `UserPassword` Prisma model — DB-backed password hash, changeable via API without restart.
- `POST /api/auth/change-password` endpoint — requires authentication + current password, validates new password strength, stores new hash in DB, revokes ALL existing sessions.
- `changePassword()` in `auth.ts` — verifies current password, validates strength (min 8 chars, at least one letter + one number), hashes with scrypt, stores in DB, revokes all sessions.
- `getActiveCredentials()` — checks DB first, falls back to env-var credentials if no DB row.
- Password change invalidates ALL sessions (force re-login everywhere).
- No password in logs or API responses.
- Verified: login → change password → old password rejected → new password works → sessions revoked.

### Login Abuse Protection (section 4)
- In-memory failed-attempt tracking per username.
- 5 failed attempts → 1 minute lockout (HTTP 429 "TOO_MANY_ATTEMPTS").
- 15 minute reset window (failed count resets if no attempts for 15 min).
- Successful login clears the failed-attempt counter.
- Rate limiting is in-memory (not DB-backed) — appropriate for local-first single-user.
- Audit events recorded for failed and successful logins.
- Verified: 5 wrong passwords → HTTP 429 lockout → wait 60s → login works.

### Session Cleanup (section 5)
- `cleanupExpiredSessions()` already exists in `auth.ts` from Spiral 21.
- Deletes sessions that are both expired AND revoked (older than 7 days), or expired beyond 7 days.
- Cleanup failure does not break authentication (wrapped in try/catch).
- Documented in `AUTHENTICATION_ARCHITECTURE.md`.

### F-002 Fix: Backup Test (section 6)
- **Root cause:** Previous backup test deleted the live DB file and restored from backup. The Next.js dev server held a stale file handle, causing "attempt to write a readonly database" until restart.
- **Fix:** The backup test now copies the DB to a temp file, verifies the copy, and verifies the ORIGINAL DB is still writable — WITHOUT replacing the original. The restore test operates on a separate copy (`/tmp/cybercc-restore-test.db`), not the live DB.
- **Regression test:** `scripts/backup-test.ts` now verifies:
  1. Backup succeeds (copy to temp).
  2. Backup is queryable (read-only).
  3. Original DB still readable after backup.
  4. Original DB still WRITABLE after backup (create + delete test project).
  5. Restore copy matches.
  6. Restored DB is queryable.
  7. NO RESTART NEEDED — DB still readable after backup+restore test.
- Verified: 7/7 PASS with no server restart required.

### Configurable Paths (section 7)
- `CACHE_DIR` env var — if set, CVE cache goes to `$CACHE_DIR/cve/` instead of the hardcoded path.
- `.env.example` updated with all configurable env vars: `DATABASE_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET`, `AUTH_DISABLED`, `AUTH_LOCAL_ROLE`, `CACHE_DIR`, `AUTH_COOKIE_SECURE`.
- Defaults documented.

### CI Pipeline (section 8)
- `.github/workflows/ci.yml` — runs on push/PR to main/master.
- Jobs: lint, security tests (path + adversarial + redaction + backup), production build.
- CI fails if any gate fails.

### GitHub Repository Preparation (section 10)
- `.gitignore` already verified in previous spirals (`.env` and `db/custom.db` untracked).
- `.env.example` updated with all configurable vars.
- CI workflow added.

## Tests executed

| Suite | Tests | Result |
|-------|-------|--------|
| `bun run lint` | — | 0 errors |
| `scripts/security-test.ts` | 13 | 13/13 PASS |
| `scripts/adversarial-test.ts` | 19 | 19/19 PASS |
| `scripts/redact-test.ts` | 7 | 7/7 PASS |
| `scripts/backup-test.ts` (F-002 fix) | 7 | 7/7 PASS (NO RESTART REQUIRED) |
| `scripts/evidence/security-test-suite.ts` | 18 | 18/18 PASS |
| `scripts/evidence/auth-session-revocation.ts` | 15 | 15/15 PASS |
| `scripts/evidence/build-smoke.ts` | 30 | 30/30 PASS |
| **Total** | **95+15=110** | **110/110 PASS (100%)** |

## Key verifications

| Feature | Verified | Evidence |
|---------|----------|----------|
| Password change | ✓ | POST /api/auth/change-password → 200; old password → 401; new password → 200 |
| Session revocation after password change | ✓ | All sessions revoked; old cookie → 401 |
| Login rate limiting | ✓ | 5 failures → HTTP 429; 60s lockout; then login works |
| F-002 fix (backup no restart) | ✓ | 7/7 backup tests pass; DB still writable after test |
| Configurable CACHE_DIR | ✓ | Env var supported; default fallback works |
| CI pipeline | ✓ | `.github/workflows/ci.yml` created |
| .env.example | ✓ | All vars documented |

## Remaining items

- Browser validation of password change UI (Settings view needs a "Change Password" form — API works, UI deferred).
- Full README.md rewrite (current README is from the platform scaffold).
- Session cleanup scheduling (function exists; not yet triggered on a timer).
- Multi-user `User` table (still single-user; documented).

## Acceptance: ACCEPTED. Status: PRODUCTION_CANDIDATE.
