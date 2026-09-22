# STATE.md — Persistent Project State

**Last updated:** 2026-09-09  **Active spiral:** 22 (complete)  **Status:** PRODUCTION_CANDIDATE

## What has been completed

- **Spirals 0-17** — built the Cybersecurity Command Center.
- **Spiral 18** — Independent audit + gap remediation.
- **Spiral 19** — Evidence-based validation (95/95 tests).
- **Spiral 20** — UI integration (LoginView, VerificationView, ThreatIntelView, AddProject, RB-011).
- **Spiral 21** — Auth hardening (F-001 session revocation, scrypt password hashing, DB-backed sessions).
- **Spiral 22 — Productionization, CI, Password Management** (this session):
  - **Password change**: `POST /api/auth/change-password` with current password verification, strength validation, DB-backed storage, all-sessions-revoked. Verified: old password rejected, new password works.
  - **Login rate limiting**: 5 failed attempts → 1 min lockout (HTTP 429). 15 min reset window.
  - **F-002 fixed**: Backup test no longer makes DB read-only. 7/7 PASS, no restart required.
  - **Configurable paths**: `CACHE_DIR` env var. `.env.example` updated.
  - **CI pipeline**: `.github/workflows/ci.yml` — lint + security tests + production build.
  - **UserPassword model**: DB-backed password hash, changeable at runtime without restart.
  - **110/110 tests pass** (95 existing + 15 session revocation).

## What is currently being worked on

Nothing — Spiral 22 complete. A fresh independent audit is recommended.

## What failed

- F-001 (P1, FIXED in Spiral 21): Session revocation.
- F-002 (P2, FIXED in this spiral): Backup test DB readonly — no longer an issue.
- Login rate limiting initially caused the test suite to fail (account locked from failed attempts during testing). Fixed by waiting for lockout expiry.

## What remains (high level)

- Browser UI for password change (API works; Settings form deferred).
- Session cleanup scheduling (function exists; not yet on a timer).
- Multi-user `User` table (still single-user; documented).
- Full README.md (current is platform scaffold).
- CISA KEV + abuse.ch feeds blocked from sandbox (environmental).

## Next task

Fresh independent audit, then potential PRODUCTION_READY promotion.
