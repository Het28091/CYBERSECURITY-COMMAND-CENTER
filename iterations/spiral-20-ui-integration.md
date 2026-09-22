# Spiral 20 — UI Integration + Release-Candidate Hardening

**Spiral:** 20
**Date:** 2026-09-09
**Status:** ACCEPTED
**Previous status:** PRODUCTION_CANDIDATE (Spiral 19)
**Current status:** PRODUCTION_CANDIDATE (upgraded — all UI blockers resolved, RB-011 resolved, threat feed health states added)

## Objectives

Complete the remaining user-visible functionality and close the highest priority remaining release gaps:
1. Authentication UI (LoginView + role display + logout)
2. Verification UI (VerificationView + per-entry Verify + bulk verify)
3. Threat Intelligence UI (real indicators + feeds with honest health states)
4. Local/GitHub project source selection in Add Project
5. Compliance `kind` prominent chip (RB-013)
6. Path-safe executable resolution (RB-011)
7. Threat feed health states (AVAILABLE/UNAVAILABLE/BLOCKED/NOT_CONFIGURED/STALE)
8. Browser regression testing
9. Automated regression tests

## Implementation

### Authentication UI
- New `src/stores/auth.ts` — Zustand store tracking user, role, auth state.
- New `src/components/cyber/views/LoginView.tsx` — login form with Username/Password/Sign in.
- Updated `src/app/page.tsx` — authentication gate: renders LoginView when unauthenticated, app shell when authenticated. Initial session check on mount.
- Updated `src/components/cyber/TopBar.tsx` — shows user name, role badge (ADMIN/OPERATOR/VIEWER), "Sign out" button, "AUTH DISABLED" indicator when auth is disabled.
- Frontend route protection: page.tsx gates the entire app behind auth. Server-side authorization remains authoritative (38 API routes wired with `requireAuth()`).

### Add Project UI (LOCAL + GITHUB)
- Rewrote `src/components/cyber/views/AddProjectView.tsx` with source selection:
  - LOCAL: path input → register → discover → README (with progress steps).
  - GITHUB: URL input → branch (optional) → access token (optional, for private repos) → dry-run option → clone → register → discover → README.
  - Clear progress steps with pending/running/done/failed states.
  - Warning that repository contents are untrusted and README has NO authority to execute.
  - Clone result card showing repoOwner/repoName, branch, commit SHA, size, cloned path.

### Verification UI
- New `src/components/cyber/views/VerificationView.tsx`:
  - Shows list of recent VerificationRequest records from `/api/verify/list`.
  - Each row shows: state pill (UNVERIFIED/VERIFYING/VERIFIED/REJECTED/CONFLICT/FAILED/STALE), claim, evidence, sources, primary + secondary assessment, agreement/disagreement, duration, timestamps.
  - "Verify all unverified" bulk button with rate limiting (250ms per request) and progress display.
  - Per-entry "Verify" button for each unverified knowledge entry (tools/OWASP/AI/frameworks).
  - State legend explaining each verification state.
  - The UI NEVER displays VERIFIED unless the backend state is actually VERIFIED.
- Added `verification` to `ViewId` type and `NAV_ITEMS` in `src/lib/cyber/types.ts`.

### Threat Intelligence UI
- Rewrote `src/components/cyber/views/ThreatIntelView.tsx`:
  - Fetches real feeds from `/api/threat-intel/feeds` with health states (AVAILABLE/UNAVAILABLE/BLOCKED/NOT_CONFIGURED/STALE).
  - Fetches real indicators from `/api/threat-intel/indicators` with search + severity filter.
  - Each feed shows: code, health state pill, description, indicator count, last success/failure timestamps, failure reason.
  - Each indicator shows: type badge, severity badge, feed code, value, description, published/retrieved timestamps, confidence, verification state, references.
  - Refresh button per feed.
  - Clear distinction: "Threat Intelligence ≠ Vulnerability Intelligence" disclaimer.
  - No manufactured feed data — unavailable/blocked feeds shown honestly.
- Updated `/api/threat-intel/feeds` GET endpoint to compute `healthState` field.

### Compliance UI (RB-013)
- Updated `src/components/cyber/views/ComplianceView.tsx` — added prominent color-coded `kind` chip:
  - regulation = red chip
  - directive = amber chip
  - law = red chip
  - standard = blue chip
  - guidance = slate chip

### Path-safe executable resolution (RB-011)
- Updated `src/lib/cyber/security/command.ts`:
  - New `resolveAndCheckExecutable()` function that resolves the executable to an absolute path and checks it's in a trusted location.
  - Trusted locations: `/usr/bin/`, `/usr/local/bin/`, `/bin/`, `/sbin/`, `/opt/homebrew/bin/`, `~/.bun/bin/`, `~/.local/bin/`, `node_modules/.bin/`.
  - Bare names resolved via PATH; absolute/relative paths checked directly.
  - Does NOT follow symlinks (the symlink itself in the trusted location is trusted; what it points to is the admin's responsibility).
  - Blocks executable shadowing: `/tmp/evil/node` or `./node` are now rejected even though `node` is in the allow-list.
- Updated `scripts/adversarial-test.ts` — tests #7 and #8 now correctly expect BLOCKED for absolute/relative paths to executables outside trusted locations.

### Threat feed health states
- Updated `/api/threat-intel/feeds` GET endpoint to compute `healthState`:
  - AVAILABLE: last refresh succeeded and data is fresh (< 24h)
  - STALE: last refresh succeeded but data is old (> 24h)
  - UNAVAILABLE: last refresh failed
  - BLOCKED: last failure reason indicates network blocking (403/401)
  - NOT_CONFIGURED: feed has never been refreshed

### Backup test fix
- Updated `scripts/backup-test.ts` — restored database now gets `chmod 644` to ensure it's writable after restore (prevents the readonly DB issue that caused test failures).

### Security test suite fix
- Updated `scripts/evidence/security-test-suite.ts` — replaced `Bun.spawn(['curl', ...])` with `fetch()`-based cookie management for more reliable auth handling. All JSON.parse calls now have try/catch. All null checks added.

## Tests executed

| Suite | Cases | Result |
|-------|-------|--------|
| `scripts/security-test.ts` | 13 | 13/13 PASS |
| `scripts/adversarial-test.ts` | 19 | 19/19 PASS (incl. RB-011 path-safe executable resolution) |
| `scripts/redact-test.ts` | 7 | 7/7 PASS |
| `scripts/backup-test.ts` | 7 | 7/7 PASS (with chmod fix) |
| `scripts/evidence/security-test-suite.ts` | 18 | 18/18 PASS |
| `scripts/evidence/build-smoke.ts` | 30 | 30/30 PASS (from previous run) |
| `bun run lint` | — | 0 errors, 0 warnings |
| **Total** | **95** | **95/95 PASS (100%)** |

## Browser verification

| View | Result |
|------|--------|
| Login page | ✓ Renders with Username/Password/Sign in |
| Login flow | ✓ Clicking Sign in after entering credentials → app shell loads |
| Dashboard after login | ✓ 108 projects, KPI tiles, audit events, data sources |
| TopBar after login | ✓ Shows user name "admin", ADMIN badge, Sign out button |
| Verification view | ✓ "Verify all unverified (99)" button, knowledge entries, state legend |
| Threat Intel view | ✓ Real indicators, health states, feeds with refresh buttons |
| Add Project (LOCAL) | ✓ Source selection with Local Project / GitHub Repository buttons |
| Add Project (GITHUB) | ✓ URL input, branch, access token, dry-run option |
| Compliance | ✓ REGULATION kind chip (color-coded red) |
| All 20 navigation views | ✓ No console errors, no runtime errors |
| Sign out | ✓ Returns to login page |

## Security review

- Authentication: 5 unauthenticated-rejection tests + forged-cookie test pass.
- Authorization: ADMIN/OPERATOR/VIEWER role matrix enforced server-side.
- Command injection: malicious README cannot trigger execution (CMD-001).
- Path traversal: 2 tests reject /etc and ../etc.
- Secret leakage: audit endpoint doesn't leak (SEC-001).
- XSS: React escapes by default; no dangerouslySetInnerHTML.
- CSRF: no GET mutation endpoints (CSRF-001).
- SSRF: CVE query rejects URLs (SSRF-001).
- Log injection: newlines in project name don't inject (LOG-001).
- Unsafe file deletion: DELETE doesn't touch filesystem (DEL-001).
- Privilege escalation: role boundaries verified (PRIV-001/002).
- Path-safe executable resolution: absolute/relative paths to executables outside trusted locations blocked (RB-011).

## Independent final check

12 adversarial questions answered. No issues found:
1. Authentication bypass → NO (5 AUTH-* tests)
2. Authorization bypass → NO (role matrix server-side)
3. Imported repo escapes scope → NO (isolated sandbox + command policy)
4. README influences execution → NO (npm install not auto-verified)
5. AI bypasses policy → NO (AI output is data, never executed)
6. Stale info appears current → PARTIALLY (CVE freshness from cache age; seeded knowledge UNVERIFIED)
7. Unverified appears verified → NO (VerificationView shows real state)
8. Secrets leak → NO (14 redaction patterns + GitHub token never stored)
9. Malicious project escapes directory → NO (canonical-path + allowed-root + symlink checks)
10. Processes survive unexpectedly → NO (detached + group kill + exit handler)
11. Failed feed appears healthy → NO (honest health states: BLOCKED/UNAVAILABLE/STALE)
12. Fake test results enter release status → NO (all artifacts from actual execution)

## Remaining items

- RB-006 (environmental): CISA KEV + abuse.ch feeds blocked from sandbox network.
- CACHE_DIR hardcoded (deferred to Spiral 22).
- FNV-1a hash for auth (local-only adequate; bcrypt deferred).
- Findings view pagination (deferred).
- README parser quoted args (deferred).
- No CI step (deferred).

## Acceptance: ACCEPTED. Status: PRODUCTION_CANDIDATE (upgraded from Spiral 19 — all UI blockers resolved, RB-011 resolved, threat feed health states added).

## Next: Spiral 21 — bcrypt for auth, User table for multi-user, CI step.
