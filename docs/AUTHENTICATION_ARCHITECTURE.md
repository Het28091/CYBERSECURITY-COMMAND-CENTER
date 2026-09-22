# AUTHENTICATION_ARCHITECTURE.md

**Version:** 2.0 (Spiral 21 — F-001 fix)
**Date:** 2026-09-09

## Overview

The Cybersecurity Command Center uses a **DB-backed session** architecture.
Sessions are created at login, stored in a SQLite `Session` table, validated
on every authenticated request, and **revoked server-side at logout**.

This replaces the previous stateless HMAC-signed cookie (Spiral 19-20) which
had a P1 security defect (F-001): stolen cookies remained valid after logout.

## How sessions are created

1. User POSTs `/api/auth/login` with username + password.
2. `login()` verifies credentials using **scrypt** (replaces FNV-1a).
3. `createSession()` generates a `cuid` session ID, embeds it in an HMAC-signed
   cookie payload, AND creates a `Session` row in the DB with:
   - `id`: the session ID
   - `tokenHash`: SHA-256 of the full signed cookie value (for lookup)
   - `userId`: "admin" (local-only) or future User ID
   - `role`: ADMIN / OPERATOR / VIEWER
   - `createdAt`: now
   - `expiresAt`: now + 8h (SESSION_TTL_MS)
   - `revokedAt`: null (active)
4. The signed cookie is set via `Set-Cookie: HttpOnly; SameSite=Strict`.

## How sessions are signed

- The cookie value is `base64url(JSON_payload).HMAC_SHA256(payload, secret)`.
- The secret comes from `AUTH_SECRET` env var (or a derived fallback for local-only).
- Signature verification uses `crypto.timingSafeEqual` (constant-time comparison).
- Tampered cookies fail the HMAC check and are rejected.

## How sessions are validated

On every API request, `requireAuth()` → `getSession()` checks:

1. **Cookie exists** — no cookie → 401.
2. **HMAC signature valid** — tampered cookie → 401.
3. **Payload parses** — malformed JSON → 401.
4. **Payload not expired** — `exp < Date.now()` → 401.
5. **DB row exists** — `Session.findUnique({ tokenHash })` → not found → 401.
6. **DB row not revoked** — `revokedAt !== null` → 401. ← **F-001 fix**
7. **DB row not expired** — `expiresAt < now` → 401.

All 7 checks must pass. If any fails, the request is rejected with 401.

## Where session state lives

- **Cookie**: contains the session ID + user info + expiry, HMAC-signed.
- **Database**: `Session` table with `tokenHash`, `revokedAt`, `expiresAt`.

The cookie is the transport; the DB is the authority. The cookie alone is
insufficient — the DB must confirm the session is active.

## Cookie lifetime

- 8 hours (`SESSION_TTL_MS = 8 * 60 * 60 * 1000`).
- Both the cookie's `Max-Age` and the DB `expiresAt` are set to this value.
- After expiry, both the cookie and the DB row reject the session.

## Logout behavior

1. `POST /api/auth/logout` calls `revokeSession(req)`.
2. `revokeSession()` marks the DB `Session.revokedAt = new Date()`.
3. The response clears the client cookie (`Set-Cookie: Max-Age=0`).
4. Any subsequent request with the old cookie fails step 6 of validation
   (DB row has `revokedAt !== null` → 401).

**This is the F-001 fix**: a stolen cookie replayed after logout is rejected
because the DB row is revoked, regardless of the client-side cookie state.

## Session rotation

Each login creates a new session (new `Session` row + new cookie). Old sessions
are NOT automatically revoked on new login — this allows concurrent sessions
(e.g. user logs in from two browsers). To revoke all sessions, the user must
explicitly log out from each.

## Session revocation

- **Explicit logout**: `revokeSession()` marks `revokedAt = now`.
- **Expiry**: `expiresAt` is checked on every request.
- **Housekeeping**: `cleanupExpiredSessions()` can be called to delete old rows.

## Password hashing

- **Before**: FNV-1a 32-bit hash (not cryptographically secure).
- **After (Spiral 21)**: **scrypt** (Node.js built-in `node:crypto`).
  - Parameters: N=16384, r=8, p=1, keyLen=64.
  - Format: `scrypt:N:r:p:base64(salt):base64(hash)`.
  - Verification uses `crypto.timingSafeEqual` (constant-time comparison).
  - scrypt is memory-hard, resistant to GPU/ASIC attacks, and stronger than bcrypt.

## Cookie security attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| HttpOnly | yes | Prevents JavaScript access to cookie |
| SameSite | Strict | Prevents CSRF via cross-site requests |
| Secure | yes (production) | Only sent over HTTPS |
| Path | / | Available to all routes |
| Max-Age | 28800 (8h) | Matches session TTL |

## Threat model

| Threat | Mitigation |
|--------|------------|
| Stolen cookie replayed after logout | DB `revokedAt` check (F-001 fix) |
| Cookie tampering | HMAC-SHA256 signature with timing-safe comparison |
| Cookie forgery | HMAC requires server secret; attacker cannot sign |
| Session fixation | New session ID on every login; old sessions not reused |
| Brute-force password | scrypt (memory-hard, 16384 iterations) |
| Concurrent session abuse | Each session independently revocable |
| Expired session reuse | Both payload `exp` and DB `expiresAt` checked |
| CSRF | SameSite=Strict + no GET mutations |
| XSS cookie theft | HttpOnly prevents `document.cookie` access |

## Limitations (local-first single-user)

- Only one user (`admin`); no `User` table yet.
- Password stored in env var (`AUTH_PASSWORD`); hashed with scrypt at startup.
- No password-change endpoint (user changes env var + restarts).
- `AUTH_DISABLED=true` skips all auth (for local-only trusted deployments).
- No rate limiting on login attempts (mitigated by scrypt cost + localhost bind).

These limitations are appropriate for a local-first single-user deployment.
For multi-user or network-exposed deployment, a `User` table, login rate
limiting, and password-change endpoint should be added (Spiral 22+).
