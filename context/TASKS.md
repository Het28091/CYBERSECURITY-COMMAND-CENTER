# TASKS.md — Live Task Queue

**Last updated:** 2026-09-09  **Active spiral:** 21 (planned)

## Active

| ID | Title | Priority | Status | Dependencies |
|----|-------|----------|--------|--------------|
| T-301 | Replace FNV-1a with bcrypt for password hashing | P1 | pending | — |
| T-302 | `User` table for multi-user support | P1 | pending | T-301 |
| T-303 | Password-change endpoint + UI | P1 | pending | T-301 |
| T-304 | CI step (lint + tests + build + smoke) | P1 | pending | — |
| T-305 | CACHE_DIR configurable via env var | P2 | pending | — |
| T-306 | Findings view pagination | P2 | pending | — |
| T-307 | PDF export endpoint | P2 | pending | — |
| T-308 | Per-project log cap enforcement | P2 | pending | — |
| T-309 | README parser handles quoted args properly | P3 | pending | — |

## Done in Spiral 20 (this session)

| ID | Title | Status |
|----|-------|--------|
| T-201 | LoginView UI component calling /api/auth/login | DONE |
| T-202 | VerificationView UI showing VerificationRequest list | DONE |
| T-203 | Per-entry "Verify" button on tools/OWASP/AI/framework cards | DONE |
| T-204 | Bulk verify with rate limiting (250ms per request) | DONE |
| T-205 | Update ThreatIntelView to show real indicators + feeds | DONE |
| T-206 | Update AddProjectView to support LOCAL + GITHUB sources | DONE |
| T-207 | Browser-verify new views (login + verification + threat-intel + add-project) | DONE |
| T-210 | Path-safe executable resolution (resolveAndCheckExecutable) | DONE |
| T-216 | Compliance `kind` prominent chip in UI (RB-013) | DONE |
| T-S20-01 | Threat feed health states (AVAILABLE/UNAVAILABLE/BLOCKED/NOT_CONFIGURED/STALE) | DONE |
| T-S20-02 | Backup test chmod fix (prevent readonly DB) | DONE |
| T-S20-03 | Security test suite fetch-based cookie management + null-safe JSON.parse | DONE |
| T-S20-04 | 95/95 evidence-based tests pass (100% pass rate) | DONE |
| T-S20-05 | Independent final check (12 adversarial questions — no issues) | DONE |
