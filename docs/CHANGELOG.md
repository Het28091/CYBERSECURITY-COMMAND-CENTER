# CHANGELOG.md

## [0.2.0] — 2026-09-09 — Spiral 18: Independent Audit + Gap Remediation

### Audit
- Retracted the previous "all spirals complete" declaration after an independent audit.
- Built `docs/REQUIREMENTS_TRACEABILITY.md` mapping every requirement to implementation + test + evidence + status.
- Built `docs/FINAL_GAP_ANALYSIS.md` with 28 gaps classified P0–P3.
- Built `docs/RELEASE_BLOCKERS.md` with 13 release blockers (6 P0 + 7 P1).
- Built `docs/FINAL_AUDIT_REPORT.md` with overall status CONDITIONALLY_READY.
- Ran new adversarial test suite (`scripts/adversarial-test.ts`, 19 cases).
- Ran production build (`bun run build` + standalone server) — verified working.
- Ran backup/restore test (`scripts/backup-test.ts`, 7 cases pass).
- Ran performance test (105 projects + 5000 findings — acceptable).

### P0 fixes (5 of 6 resolved)
- **GAP-001**: Secondary AI Verification — new `src/lib/cyber/verification/engine.ts` with full workflow (Primary → Evidence → Secondary LLM → Compare → Store). State machine: UNVERIFIED → VERIFYING → VERIFIED | REJECTED | CONFLICT | FAILED | STALE | UNKNOWN. Timeout never becomes VERIFIED. New `VerificationRequest` Prisma model. New endpoints: `POST /api/verify`, `GET /api/verify/list`, `POST /api/verify/entry/{kind}/{id}`. Verified by real LLM dispatch (AGREE + CONFLICT cases).
- **GAP-002**: Block-list tightening — added `rm -rf /<path>` (any path), `curl -o /etc/...`, `wget -O /etc/...`, `crontab|at`, `PATH=` patterns. Adversarial tests now 19/19 PASS.
- **GAP-003**: Seeded knowledge — new `scripts/reset-verification.ts` resets 100 entries from VERIFIED to UNVERIFIED. Seed script updated. New `POST /api/verify/entry/{kind}/{id}` performs REAL verification via HTTP HEAD/GET to the official URL.
- **GAP-004**: Removed unjustified auto-verification of `npm install <anything>` and `python -m <anything>`.
- **GAP-005**: Grandchild process tracking — spawn with `detached: true`; stop uses `process.kill(-proc.pid, signal)` to signal the entire process group.

### P0 partial (1 of 6)
- **GAP-006**: Threat Intelligence — new `ThreatFeed` + `ThreatIndicator` Prisma models, new `src/lib/cyber/threatintel/feeds.ts` with 3 adapters. `osv-watchlist` works (867 real indicators). `cisa-kev` returns HTTP 403 from sandbox. `abuse-ch-threatfox` returns HTTP 401. Architecture is extensible.

### P1 fixes (4 of 7 resolved)
- **GAP-008**: `.env.example` env vars loaded into spawn env at run time. Process manager STRIPS dangerous env vars (PATH, LD_PRELOAD, LD_LIBRARY_PATH, DYLD_*, NODE_OPTIONS, PYTHONPATH, PERL5OPT, RUBYOPT, JAVA_TOOL_OPTIONS, GIT_CONFIG, GIT_SSL_NO_VERIFY, npm_config_cache, NODE_EXTRA_CA_CERTS, ELECTRON_RUN_AS_NODE).
- **GAP-009**: CVE caching — disk cache at `cache/cve/` with TTL (1h OSV, 6h NVD). `freshness` from cache age. Stale-cache fallback on network failure.
- **GAP-010**: Dependency scanner now real SCA — queries OSV.dev per top-level dependency. Findings have real severity from OSV.
- **GAP-012**: Data export endpoints — `GET /api/export/{audit|findings|projects}?format=csv|json|md`. Redaction applied.
- **GAP-019**: NVD operator-precedence bug fixed.

### P1 partial (3 of 7)
- **GAP-007**: Authentication not implemented — documented as "local-first single-user" scope. NextAuth wiring deferred to Spiral 20.
- **GAP-011**: `checkCommand` allow-list uses basename only — defense-in-depth, currently mitigated. Fix in Spiral 21.
- **GAP-013**: Compliance `kind` not prominent in UI — cosmetic; existing UI acceptable.

### Tests
- `scripts/security-test.ts` — 13/13 PASS
- `scripts/adversarial-test.ts` — 19/19 PASS (was 18/19 before block-list fix)
- `scripts/redact-test.ts` — 7/7 PASS
- `scripts/backup-test.ts` — 7/7 PASS (new)
- `bun run lint` — 0 errors
- `bun run build` — success; standalone server returns 200

### Status
- **CONDITIONALLY_READY** (was incorrectly declared PRODUCTION_READY in the previous session).
- 9 of 13 release blockers resolved.
- 4 residual blockers (1 environmental, 1 defense-in-depth, 1 documented limitation, 1 cosmetic).
- Next: Spiral 19 — UI integration + bulk verification.

---

## [0.1.0] — 2026-09-08 — Spirals 0-17 (retracted)

The previous "all spirals complete" declaration is retracted. See Spiral 18 audit for the gap analysis.

### Spiral 0 — Project Discovery and Requirements
### Spiral 1 — Application Foundation
### Spiral 2 — Project Registry
### Spiral 3 — Project Discovery Engine
### Spiral 4 — README Intelligence Engine
### Spiral 5 — Safe Project Runner + WS Mini-Service
### Spiral 6 — Process Management UI
### Spiral 7 — Health Checks & Logging
### Spiral 8 — Cybersecurity Knowledge Center
### Spiral 9 — CVE & Vulnerability Intelligence
### Spiral 10 — OWASP Knowledge System
### Spiral 11 — AI & LLM Security Center
### Spiral 12 — Scanner Plugin Architecture
### Spiral 15 — Compliance-Readiness System
### Spiral 16 — Security Hardening
### Spiral 17 — Production Readiness (declaration retracted)
