# Spiral 6 — Process Management & Monitoring

**Spiral:** 6  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Live view of running projects, with stop/restart/health actions.

## Requirements Addressed
FR-050 to FR-053.

## Implementation
- `RunningProjectsView` polls `/api/projects` every 3s, filters by
  RUNNING / STARTED / STARTING / STOPPING.
- Each project card shows: name, status pill, health pill, run command,
  local path, and action buttons (Stop, Restart, Health, Logs).
- `POST /api/projects/[id]/stop` → SIGTERM then SIGKILL.
- `POST /api/projects/[id]/restart` → stop + run sequence.

## Tests
- Browser: view renders when projects are running.
- Stop API works (verified via curl).
- Empty state shows "NO PROJECTS RUNNING" with a "Browse projects"
  CTA.

## Acceptance: ACCEPTED. Next: Spiral 7 (Health & Logs).
