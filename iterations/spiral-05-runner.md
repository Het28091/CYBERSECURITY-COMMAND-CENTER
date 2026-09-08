# Spiral 5 — Safe Project Runner + WS Mini-Service

**Spiral:** 5  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Spawn tracked child processes safely, capture stdout/stderr, apply
timeouts and graceful shutdown, and stream events to the browser via a
WebSocket mini-service.

## Requirements Addressed
FR-030 to FR-040 (validate, scope, dry-run, capture, timeout, stop,
  Docker unavailable), SEC-CMD-001 to SEC-CMD-008, SEC-PROC-001 to
  SEC-PROC-004, SEC-CMD-003 (argv, never shell).

## Implementation
- `src/lib/cyber/runner/runners.ts` implements 6 runners:
  NodeRunner, PythonRunner, GoRunner, RustRunner, DockerRunner,
  ShellRunner. Each has a `supported` flag and an `unsupportedReason`.
- `src/lib/cyber/runner/process.ts` is the ProcessManager:
  - Spawns via `child_process.spawn(exe, args, { cwd, env, stdio })`
    with `shell: false` (argv, never shell string).
  - Tracks pid, logs stdout/stderr to the DB (redacted).
  - Emits events to the WS bridge (port 3003 `/emit`).
  - SIGTERM with grace period, then SIGKILL.
  - Per-command timeout enforced.
- `mini-services/proc-ws/` is a separate bun+socket.io service on port
  3003 with hot reload (`bun --hot`). Forwards events to browser
  subscribers via room `project:<id>`.
- Browser hook `useProcWs(projectId?)` connects to
  `io('/', { query: { XTransformPort: '3003' } })` per the platform
  skill's gateway requirement.

## Tests
- Dry-run on cyber-test-target: resolved command `bun run dev` with
  evidence `package.json:scripts.dev`, confidence HIGH.
- Real run: spawned with pid, captured stdout/stderr including the
  EADDRINUSE error (-98) when port 3000 was already in use by the dev
  server itself.
- Health probe: process is dead after the crash, port closed.
- Stop: SIGTERM then SIGKILL on tracked children.
- Audit: every action (project.run, project.stop, dryRun) recorded
  with pid, executionId, executable, args, source, confidence.

## Security Review
- Command allow-list + block-list verified by scripts/security-test.ts
  (13 cases pass).
- Path safety verified (5 cases pass).
- No shell interpretation (argv only).
- Working directory always the project's canonical path.

## Acceptance: ACCEPTED. Next: Spiral 6 (Process Management UI).
