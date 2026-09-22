# RELEASE_BLOCKERS.md — Cybersecurity Command Center

**Audit date:** 2026-09-09 (post-spiral-audit-fixes)

A release blocker must be resolved (or explicitly accepted as a documented limitation) before the system can be called PRODUCTION_READY.

---

## Resolved release blockers (10/14)

| ID | Description | Resolution | Evidence |
|----|-------------|------------|----------|
| RB-001 | Secondary AI Verification | `src/lib/cyber/verification/engine.ts` + `POST /api/verify`; verified AGREE + CONFLICT | Spiral 18 |
| RB-002 | Block-list bypasses | Block-list tightened; `scripts/adversarial-test.ts` 19/19 | Spiral 18 |
| RB-003 | Seeded VERIFIED stamping | Reset to UNVERIFIED; real URL verification via `/api/verify/entry/{kind}/{id}` | Spiral 18 |
| RB-004 | Unjustified auto-verification of npm install / python -m | Removed; tested with malicious README | Spiral 18 |
| RB-005 | Grandchild process tracking | `detached: true` + `process.kill(-pid)` | Spiral 18 |
| RB-007 | Authentication | `src/lib/cyber/auth.ts` + 38 routes wired + 7 tests pass | Spiral 19 (this session) |
| RB-008 | .env.example env vars | Loaded at spawn; PATH/LD_PRELOAD stripped | Spiral 18 |
| RB-009 | CVE caching + freshness + NVD bug | Disk cache + freshness from cache age; precedence bug fixed | Spiral 18 |
| RB-010 | Dependency scanner SCA | Real OSV query per dep | Spiral 18 |
| RB-012 | Data export endpoints | CSV/JSON/MD | Spiral 18 |

## Partially resolved (2/14)

| ID | Description | Residual | Recommendation |
|----|-------------|----------|----------------|
| RB-006 | Threat Intelligence feed | OSV Watchlist works (867 indicators); CISA KEV + abuse.ch blocked from this sandbox network (HTTP 403/401) | Environmental. In an unrestricted network all 3 feeds should work. Architecture is extensible. |
| RB-011 | `checkCommand` basename-only | Defense-in-depth; currently mitigated by runners using unqualified names. | Spiral 21 will resolve executable via PATH at spawn time and reject unsafe locations. |

## Open release blockers (2/14)

| ID | Description | Severity | Recommendation |
|----|-------------|----------|----------------|
| RB-013 | Compliance `kind` not prominent UI chip | Cosmetic (P1) | Existing UI shows kind in detail row. Add a color-coded chip at the top of each framework detail (Spiral 19). |
| RB-014 | UI not yet updated for new verification + threat-intel endpoints | P1 | The endpoints work via API (verified by `artifacts/tests/build-smoke.json` smoke tests). Spiral 19 will add UI. |

---

## Promotion criteria

The system can be promoted from **PRODUCTION_CANDIDATE** → **PRODUCTION_READY** when:

1. **RB-014 resolved**: UI added for `/api/verify`, `/api/verify/entry/{kind}/{id}`, `/api/threat-intel/feeds`, `/api/threat-intel/indicators`. (Spiral 19)
2. **RB-013 resolved** (or accepted as cosmetic): Compliance `kind` chip added. (Spiral 19)
3. **RB-006 confirmed**: In the production network, verify CISA KEV and abuse.ch feeds are reachable. If still blocked, document as a known limitation. (Post-deployment)
4. **RB-011 resolved** (optional): Path-safe executable resolution at spawn time. (Spiral 21)

---

## Current status

**PRODUCTION_CANDIDATE** (per `artifacts/reports/release-readiness.json`)

- 95/95 evidence-based tests pass
- Real production build verified (30/30 build-smoke steps, 16/16 API smoke tests)
- Real persistence verified (project survives restart)
- Real GitHub import verified (octocat/Hello-World cloned, registered, full workflow ran)
- Real authentication verified (login + cookie + session + logout)
- Real authorization verified (5 AUTH-* + 2 AUTHZ-* tests)
- Real security tests verified (18 security-suite + 19 adversarial + 13 path-safety + 7 redaction)
- Real backup/restore verified (7/7 backup tests)

The system is NOT yet PRODUCTION_READY because of RB-014 (UI work) and the optional RB-013 (cosmetic chip).
