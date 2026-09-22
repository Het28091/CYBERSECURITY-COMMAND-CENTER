# LOCAL_DEPLOYMENT.md — Cybersecurity Command Center

**Audit date:** 2026-09-09
**Method:** Actual execution of every command below; results captured in `artifacts/tests/build-smoke.json` and `.md`.

This document describes the exact commands for a real local production deployment. It does NOT use the development server as proof of production readiness.

---

## Prerequisites

- Linux/macOS (the runner uses process groups which are Linux/macOS only)
- Node.js 24+
- bun (installed automatically by the platform)
- 200 MB free disk space

---

## Step 1 — Install dependencies

```bash
cd /home/z/my-project
bun install
```

**Expected:** Installs all npm dependencies. Exits 0.

**Verified:** `artifacts/tests/build-smoke.json` step "Install dependencies" → exit 0.

---

## Step 2 — Run database migrations

```bash
cd /home/z/my-project
bun run db:push
```

**Expected:** Prisma pushes the schema to SQLite at `db/custom.db`. Output ends with `🚀 Your database is now in sync with your Prisma schema.`

**Verified:** `artifacts/tests/build-smoke.json` step "Database push (migrations)" → exit 0.

---

## Step 3 — (Optional) Seed the knowledge base

```bash
cd /home/z/my-project
bun run scripts/seed.ts
```

**Expected:** Seeds 50 cybersecurity tools, 30 OWASP entries, 15 AI security entries, 5 compliance frameworks (31 controls), 10 data sources, default settings. Output ends with `Seed completed.`

**Note:** Seeded entries have `verificationStatus: 'UNVERIFIED'` by default. To verify individual entries, call `POST /api/verify/entry/{kind}/{id}` (kind: tool|owasp|ai|framework).

---

## Step 4 — Build the production application

```bash
cd /home/z/my-project
bun run build
```

**Expected:** Next.js 16 builds a standalone server at `.next/standalone/server.js`. Output ends with `✓ Generating static pages` and a route tree.

**Verified:** `artifacts/tests/build-smoke.json` step "Production build" → exit 0.

**Output:**
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/...
└ ...
```

---

## Step 5 — Start the production server

```bash
cd /home/z/my-project
NODE_ENV=production bun .next/standalone/server.js
```

Or in the background:

```bash
cd /home/z/my-project
nohup bash -c "NODE_ENV=production bun .next/standalone/server.js" > prod.log 2>&1 &
```

**Expected:** Server starts on port 3000. Process detaches if backgrounded.

**Verified:** `artifacts/tests/build-smoke.json` step "Wait for production server to come up" → server up.

---

## Step 6 — Run health checks

```bash
# Login first (default credentials: admin / changeme — CHANGE IMMEDIATELY)
curl -s -c /tmp/c.txt -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}'

# Health check (with auth)
curl -s -b /tmp/c.txt http://127.0.0.1:3000/api/system/health
```

**Expected:**
```json
{"ok":true,"data":{"db":"ok","fs":"ok","ws":"ok","overall":"HEALTHY"}}
```

**Verified:** `artifacts/tests/build-smoke.json` smoke test "Health" → HTTP 200.

---

## Step 7 — Run API smoke tests

The build-smoke test suite verifies all 16 API endpoints return their expected status. Each is checked in `artifacts/tests/build-smoke.json`:

| Endpoint | Method | Expected | Verified |
|----------|--------|----------|----------|
| `/` (homepage) | GET | 200 | ✓ |
| `/api/system/health` | GET | 200 (auth required) | ✓ |
| `/api/projects?limit=10` | GET | 200 (auth) | ✓ |
| `/api/owasp` | GET | 200 (auth) | ✓ |
| `/api/ai-security` | GET | 200 (auth) | ✓ |
| `/api/tools` | GET | 200 (auth) | ✓ |
| `/api/compliance` | GET | 200 (auth) | ✓ |
| `/api/audit?limit=5` | GET | 200 (auth) | ✓ |
| `/api/system/datasources` | GET | 200 (auth) | ✓ |
| `/api/scanners` | GET | 200 (auth) | ✓ |
| `/api/search?q=test` | GET | 200 (auth) | ✓ |
| `/api/threat-intel/feeds` | GET | 200 (auth) | ✓ |
| `/api/threat-intel/indicators?limit=5` | GET | 200 (auth) | ✓ |
| `/api/verify/list` | GET | 200 (auth) | ✓ |
| `/api/settings` | GET | 200 (admin) | ✓ |
| `/api/projects?limit=1` (unauthenticated) | GET | 401 | ✓ |

---

## Step 8 — Browser / end-to-end smoke tests

Run the agent-browser self-verification:

```bash
agent-browser open http://127.0.0.1:3000/
agent-browser snapshot -i
# Should show: 18 nav buttons, KPI tiles, etc.
```

For the full E2E smoke test, see `scripts/evidence/security-test-suite.ts` which exercises authentication + authorization + path traversal + XSS + CSRF + SSRF + log injection + unsafe file deletion.

**Verified:** `artifacts/tests/security-tests.json` shows 18/18 PASS.

---

## Step 9 — Shut it down cleanly

```bash
# Find and kill the production server
ps aux | grep 'standalone/server' | grep -v grep | awk '{print $2}' | xargs -r kill
# Or use pkill
pkill -f 'standalone/server.js'
```

**Verified:** `artifacts/tests/build-smoke.json` step "Kill production server cleanly" → exit 0.

---

## Step 10 — Start it again

```bash
cd /home/z/my-project
nohup bash -c "NODE_ENV=production bun .next/standalone/server.js" > prod.log 2>&1 &
sleep 3
curl -s http://127.0.0.1:3000/api/auth/session
# Should return 401 (no session yet) — proves server is up
```

**Verified:** `artifacts/tests/build-smoke.json` step "Final restart after shutdown" → server up.

---

## Step 11 — Verify persistence

After restart, all data persisted in `db/custom.db` is preserved:

```bash
# Login
curl -s -c /tmp/c.txt -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}'

# Verify projects persisted
curl -s -b /tmp/c.txt http://127.0.0.1:3000/api/projects?limit=200 | jq '.data | length'
# Should show the same project count as before the restart

# Verify audit events persisted
curl -s -b /tmp/c.txt http://127.0.0.1:3000/api/audit?limit=5 | jq '.data | length'
# Should show audit events from before the restart
```

**Verified:** `artifacts/tests/build-smoke.json` step "Persistence: project survived restart" → project `cmttqk7vj006iogpbb4hk1gku` found after restart.

---

## Authentication

Default credentials: `admin` / `changeme`. **Change these immediately** by setting environment variables:

```bash
# In .env
AUTH_USERNAME=your-username
AUTH_PASSWORD=your-strong-password
AUTH_SECRET=your-random-secret-at-least-32-chars
```

Or disable auth entirely for single-user local-only mode:

```bash
AUTH_DISABLED=true
AUTH_LOCAL_ROLE=ADMIN   # ADMIN | OPERATOR | VIEWER
```

**Warning:** Disabling auth means anyone with network access to port 3000 has full access. Do not expose externally with auth disabled.

### Role matrix

| Action | ADMIN | OPERATOR | VIEWER |
|--------|-------|----------|--------|
| read | ✓ | ✓ | ✓ |
| create | ✓ | ✓ | — |
| update | ✓ | ✓ | — |
| delete | ✓ | — | — |
| run | ✓ | ✓ | — |
| stop | ✓ | ✓ | — |
| scan | ✓ | ✓ | — |
| admin (settings, datasources) | ✓ | — | — |

---

## Background WebSocket service (optional)

The process WebSocket mini-service is on port 3003. Start it for real-time log streaming:

```bash
cd /home/z/my-project/mini-services/proc-ws
bun install
nohup bun run dev > proc-ws.log 2>&1 &
```

Browser clients connect via `io('/', { query: { XTransformPort: '3003' } })` per the platform's Caddy gateway requirement.

---

## Full evidence

The complete evidence is in:

- `artifacts/tests/build-smoke.json` — 30/30 steps passed, 16/16 smoke tests passed
- `artifacts/tests/build-smoke.md` — human-readable summary
- `artifacts/tests/security-tests.json` — 18/18 security tests passed
- `artifacts/tests/security-tests.md` — human-readable summary

To re-run all evidence-generating tests:

```bash
cd /home/z/my-project
bun run scripts/evidence/security-test-suite.ts   # 18 security tests
bun run scripts/evidence/build-smoke.ts            # 30 production-build steps
bun run scripts/security-test.ts                  # 13 path-safety + command-policy tests
bun run scripts/adversarial-test.ts               # 19 adversarial runner tests
bun run scripts/redact-test.ts                     # 7 redaction tests
bun run scripts/backup-test.ts                     # 7 backup/restore tests
bun run scripts/reset-verification.ts              # reset seed-stamped VERIFIED entries
bun run lint                                        # 0 errors
```
