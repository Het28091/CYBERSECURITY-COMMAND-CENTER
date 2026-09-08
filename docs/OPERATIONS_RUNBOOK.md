# OPERATIONS_RUNBOOK.md

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Running the Command Center

- Dev server: auto-started by the platform (port 3000).
- WebSocket mini-service: `bun run dev` inside `mini-services/proc-ws/`
  (port 3003, hot reload).
- Lint: `bun run lint`.
- DB push: `bun run db:push`.

## 2. Health

- `GET /api/system/health` returns DB / FS / WS status.
- DB down → DEGRADED; WS down → DEGRADED; both down → UNAVAILABLE.

## 3. Backup

- SQLite DB: `prisma/dev.db` — copy on demand.
- Settings: stored in `Settings` table (single row).
- Audit trail: stored in `AuditEvent` table — append-only.

## 4. Recovery

- Delete `prisma/dev.db` and run `bun run db:push` to recreate empty.
- Re-seed via `bun run scripts/seed.ts`.

## 5. Logs

- App logs: `/home/z/my-project/dev.log` (auto).
- Runner logs: `ProjectLog` table (per-project, capped).
- Audit logs: `AuditEvent` table (append-only).
- WS service logs: `mini-services/proc-ws/proc-ws.log`.

## 6. Troubleshooting

| Symptom | Action |
|---------|--------|
| Page is blank | Check `dev.log` for hydration errors. |
| Lint fails | Run `bun run lint` and fix imports. |
| WS not connecting | Verify mini-service is running on port 3003. |
| OSV lookup fails | Check `Settings.externalFetchEnabled`. |
| Project won't run | Verify `Settings.allowedProjectRoots` includes the path. |
