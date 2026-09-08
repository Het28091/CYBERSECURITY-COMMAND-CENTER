# Spiral 2 — Project Registry

**Spiral:** 2  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Implement the project registry: CRUD operations, path verification, status
machine, project cards UI, project detail view with 7 tabs.

## Requirements Addressed
FR-001 to FR-008 (registry CRUD, filter, sort, search, state machine).

## Implementation
- `POST /api/projects` with canonical-path resolution, allowed-root check,
  symlink detection, duplicate rejection.
- `GET /api/projects` with `?q=&status=&category=` filters.
- `GET/PATCH/DELETE /api/projects/[id]` with `{ confirm: true }` required
  for deletes.
- Project state machine: REGISTERED → DISCOVERED → VERIFIED → RUNNING →
  STOPPED / FAILED (etc.).
- Audit event recorded for every state change (`project.add`,
  `project.update`, `project.delete`).
- ProjectsView with grid of project cards showing status, health,
  verification, language/framework/packageManager, ports, findings count.
- ProjectDetailView with 7 tabs: Overview, Discovery, README, Logs,
  Health, Scans, Findings.

## Tests
- Registered `proc-ws-test` (Node.js/Bun) and `cyber-test-target` (this
  Next.js project) — both pass path verification.
- Registered `py-test` (Python/FastAPI) — discovery correctly detected
  language=python, framework=FastAPI, packageManager=pip, entryPoint=
  `python app.py`.
- Attempted to register `/etc/passwd` — rejected with `PATH_OUTSIDE_ROOT`.
- Attempted traversal `/home/z/my-project/../etc/passwd` — rejected
  before resolution.

## Security Review
- Path traversal protection verified by security-test.ts.
- Symlink escape protection verified.
- Delete requires `{ confirm: true }` token.

## Acceptance: ACCEPTED. Next: Spiral 3 (Discovery Engine) — already done.
