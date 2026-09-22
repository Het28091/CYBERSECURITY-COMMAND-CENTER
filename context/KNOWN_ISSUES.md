# KNOWN_ISSUES.md — Open Issues

Append-only. Newest at top.

---

## I-2026-09-09-008 — FNV-1a hash for auth (local-only adequate)

- **Impact:** FNV-1a is not cryptographically secure. Adequate for local-only single-user where the DB itself is local. For multi-user deployments, bcrypt is required.
- **Mitigation:** Documented in `src/lib/cyber/auth.ts` and `docs/RELEASE_READINESS.md`. Spiral 21 will replace with bcrypt.

## I-2026-09-09-009 — No `User` table for multi-user support

- **Impact:** Auth uses env vars + single admin. Multi-user deployments need a User table.
- **Mitigation:** Documented. Spiral 21 will add a `User` table.

## I-2026-09-09-001 — CISA KEV and abuse.ch feeds blocked from sandbox

- **Impact:** Only the OSV Watchlist threat-intel feed works in this sandbox (867 indicators). CISA KEV returns HTTP 403. abuse.ch ThreatFox returns HTTP 401.
- **Mitigation:** The adapter architecture is extensible. ThreatIntelView shows BLOCKED state honestly. In an unrestricted network, all three feeds should work.

## I-2026-09-09-002 — Verification of seeded knowledge is per-entry, not bulk

- **Impact:** Each of the 100 seed entries requires a separate `/api/verify/entry/{kind}/{id}` call. Bulk verification is available via the VerificationView UI ("Verify all unverified" button with rate limiting).
- **Mitigation:** Spiral 20 added the bulk verify UI. All 99 unverified entries can be verified with one click.

## I-2026-09-09-007 — CACHE_DIR hardcoded

- **Impact:** `src/lib/cyber/external/vulnerabilities.ts` uses `/home/z/my-project/cache/cve` as the cache directory.
- **Mitigation:** Spiral 22 will make it configurable via env var.

## I-2026-09-09-010 — Findings view does not paginate

- **Impact:** Findings view is limited to 200 findings per project. With 1000+ findings, only the first 200 are shown.
- **Mitigation:** Spiral 22 will add pagination UI.

## I-2026-09-08-001 — Docker not installed in environment

- **Impact:** DockerRunner cannot execute.
- **Mitigation:** Runner reports `DOCKER_UNAVAILABLE`.

## I-2026-09-08-002 — No Go / Rust / Ruby runtimes

- **Impact:** Projects in those languages cannot be run directly.
- **Mitigation:** Runners report `RUNTIME_NOT_INSTALLED`.
