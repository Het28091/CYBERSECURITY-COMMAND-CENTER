# ARCHITECTURE.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser  — single page at /  (src/app/page.tsx)                 │
│  - Sidebar navigation (17 sections)                             │
│  - Zustand store for current view + global app state             │
│  - TanStack Query for server state                               │
│  - WebSocket client (/?XTransformPort=3003) for live logs/status │
└───────────────────┬─────────────────────────────────────────────┘
                    │ relative-path REST + WS
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 16 App Router                                           │
│  src/app/api/...  (REST API routes)                              │
│   ├── /api/projects         CRUD                                 │
│   ├── /api/projects/[id]/discover                                  │
│   ├── /api/projects/[id]/readme                                    │
│   ├── /api/projects/[id]/run, stop, restart, verify, health, logs  │
│   ├── /api/projects/[id]/scan                                      │
│   ├── /api/tools, /api/cves, /api/owasp, /api/ai-security         │
│   ├── /api/compliance, /api/audit, /api/search, /api/system       │
│  src/lib/cyber/  (backend modules, server-only)                 │
│   ├── discovery/  Project Discovery Engine                       │
│   ├── readme/     README Intelligence Engine                     │
│   ├── runner/     Safe Project Runner                            │
│   ├── scanners/   Scanner Plugin Architecture                    │
│   ├── knowledge/  Cybersecurity knowledge catalogue              │
│   ├── compliance/ Compliance-readiness catalogue                 │
│   ├── security/  Path safety, command policy, redaction         │
│   └── audit/      Audit trail                                    │
└───────────────────┬─────────────────────────────────────────────┘
                    │ Prisma + sqlite
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  SQLite (prisma/dev.db)                                          │
└─────────────────────────────────────────────────────────────────┘

       (separate process, proxied via Caddy :81)
┌─────────────────────────────────────────────────────────────────┐
│  mini-services/proc-ws/  (port 3003, socket.io)                  │
│  - Real-time log stream from running processes                   │
│  - Status updates                                                │
│  - Health probe results                                          │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Single-Page Constraint

Per the platform skill, the user sees only the `/` route. All 17 navigation
sections (Command Center, Projects, Add Project, Running Projects, Security
Findings, Vulnerabilities, CVEs, Security Tools, OWASP, AI Security, Threat
Intelligence, Compliance, AI Agents, Automation, Logs, Audit, System,
Settings) are rendered as views inside `src/app/page.tsx` and switched via
client-side state in a Zustand store.

There is no `next/router`-based routing inside the application — only the
single `/` page plus `/api/*` routes.

## 3. Module Boundaries

Each `src/lib/cyber/*` module exposes pure functions where possible and is
imported only from `src/app/api/*` (server side) — never from client
components. This keeps client bundles small and keeps filesystem access
server-only.

## 4. Data Model (Prisma)

See `DATA_MODEL.md` for the full Prisma schema. Highlights:

- `Project` — registry entry with status, health, verification fields.
- `ProjectDiscovery` — JSON snapshot of the latest discovery result.
- `ReadmeInference` — inferred commands + cross-check results.
- `ProjectExecution` — every run/stop/restart event with stdout/stderr.
- `ProjectLog` — incremental log lines (capped).
- `ScanRun` + `ScanFinding` — scanner results.
- `SecurityTool` — cybersecurity tool catalogue.
- `OwaspEntry` — OWASP knowledge entries.
- `AiSecurityEntry` — AI/LLM security entries.
- `ComplianceFramework` + `ComplianceControl` — compliance catalogue.
- `AuditEvent` — audit trail.
- `Settings` — single-row settings table.
- `DataSource` — external source freshness tracking.

## 5. Real-Time

A WebSocket mini-service at `mini-services/proc-ws/` (port 3003) bridges the
runner and the browser. Clients connect to `io("/?XTransformPort=3003")`.
The service emits `log`, `status`, `health`, and `done` events.

## 6. External Integrations

| Integration | Purpose | Trust Tier | Endpoint |
|-------------|---------|------------|----------|
| OSV.dev | Vulnerability lookup by package | Tier 1 (Google, official) | `https://api.osv.dev/v1/query` |
| NVD (CVE details by ID) | CVE lookup | Tier 1 (NIST) | `https://services.nvd.nist.gov/rest/json/cves/2.0` |
| OWASP official pages | OWASP knowledge | Tier 1 (OWASP) | linked URLs only; content is summarized and labelled |
| Cybersecurity tool docs | Tool catalogue | Tier 1 (vendor) | linked URLs only |

All external responses are cached in `cache/` with retrieval time and
freshness tracked in the `DataSource` table.

## 7. Security Boundaries

- **Path safety**: `src/lib/cyber/security/path.ts` enforces canonical path
  resolution, allowed-root check, and symlink escape detection.
- **Command policy**: `src/lib/cyber/security/command.ts` implements an
  allow-list + block-list of executables and arguments.
- **Audit**: every state-changing API route calls `audit.record(...)`.
- **Redaction**: `src/lib/cyber/security/redact.ts` strips common secret
  patterns from logs and API responses.

## 8. Why This Stack

| Choice | Rationale |
|--------|-----------|
| Next.js 16 + TypeScript | Required by platform; strong typing for security-critical code. |
| Prisma + SQLite | Local-first, zero-ops, transactional. |
| shadcn/ui (New York) | Mature, accessible, dark-first compatible. |
| Zustand | Tiny, ergonomic client store for the single-page nav state. |
| TanStack Query | Server-state caching, retry, and invalidation. |
| Socket.io mini-service | Real-time log streaming without bloating the main Next.js process. |
| OSV.dev / NVD | Authoritative Tier-1 vulnerability sources with public APIs. |
