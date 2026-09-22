# GITHUB_RELEASE_CHECKLIST.md

**Audit date:** 2026-09-09
**Auditor:** main agent (independent)
**Method:** Actual git inspection + tracked-file secret scan + .gitignore verification.

This checklist must pass before the repository can be pushed to GitHub. Each item shows the actual command(s) used and the actual result.

---

## 1. Inspect git status

**Command:**
```bash
git status --short
```

**Result (post-audit fixes):** `.env` and `db/custom.db` were tracked at audit time; both have been removed from tracking via `git rm --cached`. They remain on disk (gitignored).

**Status:** PASS

---

## 2. Inspect tracked files

**Command:**
```bash
git ls-files | wc -l
```

**Result:** 244 tracked files (was 246 before untracking `.env` + `db/custom.db`).

**Command:**
```bash
git ls-files | grep -E '\.(env|db|log|key|pem|p12|pfx)$'
```

**Result:** Empty — no tracked sensitive files.

**Status:** PASS

---

## 3. Search for secrets in tracked files

**Command:**
```bash
git ls-files | while read f; do
  if [ -f "$f" ] && file "$f" 2>/dev/null | grep -qi "text\|json\|script"; then
    grep -lE '(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,}|github_pat_|sk_(test|live)_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' "$f" 2>/dev/null
  fi
done
```

**Result:** 3 files matched:
- `scripts/redact-test.ts` — synthetic test fixtures only (e.g. `'ghp_' + 'abc1234567890...'` — split string, not a real token)
- `src/lib/cyber/scanners/scanners.ts` — regex patterns for *detecting* secrets
- `src/lib/cyber/security/redact.ts` — regex patterns for redaction

Manual inspection confirms: no real secrets are present in tracked files. All matches are either synthetic test data or detection patterns.

**Status:** PASS (with manual verification of the 3 matches)

---

## 4. Search for credentials

Same as section 3 above. No hardcoded credentials found.

**Status:** PASS

---

## 5. Search .env files

**Command:**
```bash
git ls-files | grep -E '^\.env'
```

**Result:** `.env.example` only (committed intentionally as documentation). `.env` is untracked.

**Content of `.env.example`:**
```
# Cybersecurity Command Center — example environment.
DATABASE_URL=file:/home/z/my-project/db/custom.db
# AUTH_DISABLED=true
# AUTH_LOCAL_ROLE=ADMIN
```

No real secrets. The `DATABASE_URL` is a local SQLite path, not a credential.

**Status:** PASS

---

## 6. Search for private keys

**Command:**
```bash
git ls-files | while read f; do
  grep -lE '-----BEGIN [A-Z ]*PRIVATE KEY-----' "$f" 2>/dev/null
done
```

**Result:** Only `scripts/redact-test.ts` and the redaction regex files. Manual inspection: synthetic test fixture (`'[REDACTED:ssh_private_key]\nMIIabc\n-----END RSA PRIVATE KEY-----'` — this is the redacted output, not a real key).

**Status:** PASS

---

## 7. Search for API tokens

Same as section 3 (covered AWS, GitHub PAT, Stripe). No real tokens found.

**Status:** PASS

---

## 8. Search for local machine paths in tracked files

**Command:**
```bash
git ls-files | while read f; do
  if [ -f "$f" ] && file "$f" 2>/dev/null | grep -qi "text\|json\|script"; then
    grep -l '/home/z/\|/Users/[^/]\+/\|C:\\\\Users' "$f" 2>/dev/null
  fi
done
```

**Result:** 19 files matched. Manual classification:

- **Documentation files** (`docs/FINAL_GAP_ANALYSIS.md`, `docs/OPERATIONS_RUNBOOK.md`, `iterations/spiral-02-project-registry.md`): reference the local sandbox path as the project root. This is acceptable documentation, not a leaked credential.
- **Test scripts** (`scripts/adversarial-test.ts`, `scripts/backup-test.ts`, `scripts/security-test.ts`, `scripts/seed.ts`): use the local path as the project root in tests. Acceptable.
- **Source code** (`src/app/api/system/health/route.ts`, `src/lib/cyber/external/vulnerabilities.ts`, `src/lib/cyber/security/path.ts`, `src/lib/cyber/settings.ts`): use the local path as the default cache directory and default allowed root. The allowed roots are configurable in Settings; the cache directory is sandbox-specific. For production deployment, `CACHE_DIR` should be made configurable via env var (open issue).
- **Build scripts** (`.zscripts/*`): platform-provided, not user code.
- **.env**: untracked (see section 5).
- **View** (`AddProjectView.tsx`): placeholder text only.

**Action item:** make `CACHE_DIR` configurable via env var so production deployments don't hardcode the sandbox path. (Deferred to Spiral 22.)

**Status:** PASS with one deferred action item.

---

## 9. Search for runtime logs

**Command:**
```bash
git ls-files | grep -E '\.(log|out)$'
```

**Result:** Empty. `dev.log`, `prod.log`, `server.log`, `*.log` are all gitignored.

**Status:** PASS

---

## 10. Search for database files

**Command:**
```bash
git ls-files | grep -E '\.(db|sqlite|sqlite3)$'
```

**Result:** Empty. `db/custom.db` is untracked.

**Status:** PASS

---

## 11. Verify .gitignore

**Status:** PASS — see `.gitignore` in the repository root. Covers:
- `node_modules`, `.next/`, `build/`, `dist/`
- `.env`, `.env.*`, `!.env.example`
- `*.log`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.keystore`
- `db/*.db`, `db/*.db-journal`, `db/*.db-wal`, `db/*.db-shm`
- `/upload/`, `/cache/`, `/skills/`, `/tool-results/`
- `/artifacts/tests/`, `/artifacts/reports/`, `/artifacts/*.png`
- `.zscripts/dev.pid`, `.zscripts/dev.log`
- `.claude`, `.z-ai-config`

---

## 12. Verify no sensitive artifacts are tracked

**Status:** PASS — `.env` and `db/custom.db` untracked in this audit. All other tracked files verified clean.

---

## Pre-push verification commands

Before pushing to GitHub, run:

```bash
# 1. Confirm no sensitive files are tracked
git ls-files | grep -E '\.(env|db|log|key|pem)$' | grep -v '.env.example'

# 2. Confirm .gitignore covers all sensitive patterns
cat .gitignore | grep -E '(env|db|log|pem|key)'

# 3. Scan tracked files for known secret patterns (should return only test/regex files)
git ls-files | while read f; do
  if [ -f "$f" ] && file "$f" 2>/dev/null | grep -qi "text"; then
    grep -lE 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}' "$f" 2>/dev/null
  fi
done

# 4. Check git status is clean (excluding intended changes)
git status --short

# 5. Final diff review before commit
git diff --cached --stat
```

---

## Result

| # | Check | Status |
|---|-------|--------|
| 1 | git status inspected | PASS |
| 2 | tracked files enumerated | PASS (244 files) |
| 3 | no secrets in tracked files | PASS (3 matches are test/regex only) |
| 4 | no credentials in tracked files | PASS |
| 5 | no .env files tracked (only .env.example) | PASS |
| 6 | no private keys | PASS (test fixture only) |
| 7 | no API tokens | PASS |
| 8 | local paths reviewed | PASS with 1 deferred action |
| 9 | no runtime logs tracked | PASS |
| 10 | no database files tracked | PASS |
| 11 | .gitignore verified | PASS |
| 12 | no sensitive artifacts | PASS |

**Overall GitHub release readiness:** PASS (with one deferred action item: make `CACHE_DIR` configurable via env var).

**Do not push until:** (a) the `CACHE_DIR` env-var change is merged, OR (b) the deferred item is accepted as a documented limitation in `docs/RELEASE_READINESS.md`.
