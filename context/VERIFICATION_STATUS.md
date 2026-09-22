# VERIFICATION_STATUS.md

| Area | Status | Evidence |
|------|--------|----------|
| Authentication (backend) | VERIFIED | 7 AUTH-* + AUTHZ-* tests pass; 38 routes wired |
| Authentication (UI) | VERIFIED | LoginView renders; login flow works; logout returns to login page |
| Authorization (backend) | VERIFIED | ROLE_PERMISSIONS matrix; 38 routes enforce role |
| Authorization (UI) | VERIFIED | TopBar shows role badge; page.tsx gates behind auth |
| Path safety | VERIFIED | `scripts/security-test.ts` 13 cases |
| Path-safe executable resolution (RB-011) | VERIFIED | `scripts/adversarial-test.ts` 19/19 — absolute/relative paths outside trusted locations blocked |
| Secret redaction | VERIFIED | `scripts/redact-test.ts` 7 cases |
| Adversarial runner | VERIFIED | `scripts/adversarial-test.ts` 19/19 |
| Security test suite | VERIFIED | `artifacts/tests/security-tests.json` 18/18 |
| Block-list (curl -o /etc, wget -O /etc, rm -rf) | VERIFIED | adversarial-test.ts 19/19 |
| Grandchild process tracking | VERIFIED | `detached: true` + `process.kill(-pid)` |
| .env.example env loading | VERIFIED | loaded at spawn; PATH/LD_PRELOAD stripped |
| Project isolation (LOCAL) | VERIFIED | canonical-path + allowed-root + symlink checks |
| Project isolation (GITHUB) | VERIFIED | isolated sandbox + 50 MB limit + .git excluded |
| GitHub import | VERIFIED | Real octocat/Hello-World cloned + registered + workflow ran |
| Add Project UI (LOCAL) | VERIFIED | Browser-tested: source selection + progress steps |
| Add Project UI (GITHUB) | VERIFIED | Browser-tested: URL input + branch + token + dry-run |
| README intelligence (no auto-verification) | VERIFIED | `npm install <malicious>` NOT auto-verified |
| Verification UI | VERIFIED | VerificationView: list + per-entry Verify + bulk verify + state legend |
| Threat Intel UI | VERIFIED | ThreatIntelView: real indicators + feeds + health states + search |
| Compliance kind chip (RB-013) | VERIFIED | Color-coded prominent chip in ComplianceView |
| Threat feed health states | VERIFIED | AVAILABLE/UNAVAILABLE/BLOCKED/NOT_CONFIGURED/STALE computed from lastSuccess/lastFailure |
| CVE caching + freshness | VERIFIED | Disk cache at `cache/cve/` with TTL |
| Dependency scanner SCA | VERIFIED | Queries OSV.dev per dep |
| Secondary AI verification | VERIFIED | Real LLM dispatch: AGREE + CONFLICT cases |
| Data export | VERIFIED | CSV/JSON/MD endpoints |
| Backup/restore | VERIFIED | 7/7 tests pass (with chmod fix) |
| Production build + smoke | VERIFIED | 30/30 steps + 16/16 API smoke tests |
| Persistence | VERIFIED | project survives restart |
| Clean shutdown + restart | VERIFIED | build-smoke.json |
| Browser verification (all 20 views) | VERIFIED | No console errors, no runtime errors |
| Lint | VERIFIED | `bun run lint` 0 errors, 0 warnings |
| Total evidence-based tests | VERIFIED | **95/95 PASS (100% pass rate)** |
| GitHub release readiness | VERIFIED | `.env` and `db/custom.db` untracked; no real secrets; `.gitignore` verified |
