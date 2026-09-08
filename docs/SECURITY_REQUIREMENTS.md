# SECURITY_REQUIREMENTS.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

All `SEC-*` requirements are **P0** unless noted.

## Path Safety

| ID | Requirement |
|----|-------------|
| SEC-PATH-001 | Every project path is resolved to a canonical absolute path before use. |
| SEC-PATH-002 | Every project path must be inside one of the configured allowed roots. |
| SEC-PATH-003 | Symlinks are resolved to their real target and re-checked against allowed roots. |
| SEC-PATH-004 | Paths with `..` segments are rejected before resolution. |
| SEC-PATH-005 | Path is checked for existence and is-a-directory before any operation. |

## Command Safety

| ID | Requirement |
|----|-------------|
| SEC-CMD-001 | The runner uses an **allow-list** of executables. Anything not on the list is refused. |
| SEC-CMD-002 | The runner uses a **block-list** of dangerous tokens (`rm -rf /`, `dd if=`, `mkfs`, `:(){:|:&};:`, `> /dev/sda`, `chmod -R 777 /`, `curl | sh`, `wget | sh`, `sudo`, `su`, `nc -l`, `bash -i`, `python -c "import os; os.system(...)"`, etc.). |
| SEC-CMD-003 | Arguments are passed as an array — never concatenated into a shell string. |
| SEC-CMD-004 | The working directory is always set to the project's canonical path. |
| SEC-CMD-005 | Per-command timeout is enforced. |
| SEC-CMD-006 | Dry-run mode prints the resolved command and exits without executing. |
| SEC-CMD-007 | Commands inferred from README start at LOW confidence and require cross-check. |
| SEC-CMD-008 | High-risk commands require explicit confirmation in the UI before execution. |

## Process Safety

| ID | Requirement |
|----|-------------|
| SEC-PROC-001 | Every spawned process is tracked by pid in a process table. |
| SEC-PROC-002 | Graceful shutdown sends SIGTERM, waits `grace_period_ms`, then SIGKILL. |
| SEC-PROC-003 | On runner shutdown, all tracked children are killed. |
| SEC-PROC-004 | Orphaned children are detected (pid alive but not in table) and reported. |

## Secret Safety

| ID | Requirement |
|----|-------------|
| SEC-SEC-001 | Logs are passed through a redaction filter before persistence and before being sent to the client. |
| SEC-SEC-002 | API responses containing project env variables are redacted. |
| SEC-SEC-003 | The application never stores user-supplied secrets. |
| SEC-SEC-004 | `.env.example` documents required variables; no real values are persisted. |

## Network Safety

| ID | Requirement |
|----|-------------|
| SEC-NET-001 | The Next.js server binds to localhost by default. |
| SEC-NET-002 | The WebSocket service binds to localhost only. |
| SEC-NET-003 | External data fetches go only to OSV.dev and NVD (configurable in Settings). |
| SEC-NET-004 | All external calls have a timeout. |

## Authorization

| ID | Requirement |
|----|-------------|
| SEC-AUTH-001 | A single local user is assumed (no auth required for this session). |
| SEC-AUTH-002 | The architecture reserves an `actor` field on every audit event for future RBAC. |
| SEC-AUTH-003 | Sensitive actions (delete project, force-kill) require a confirmation token in the request. |

## Audit

| ID | Requirement |
|----|-------------|
| SEC-AUD-001 | Every state-changing API route records an audit event. |
| SEC-AUD-002 | Audit events include timestamp, actor, action, object, result, reason. |
| SEC-AUD-003 | Audit events are append-only; no update or delete API exists. |
| SEC-AUD-004 | Audit events never include secrets (post-redaction). |

## Input Validation

| ID | Requirement |
|----|-------------|
| SEC-IN-001 | Every API route validates its request body / query with Zod. |
| SEC-IN-002 | Every API route returns a structured error on validation failure. |

## LLM Safety

| ID | Requirement |
|----|-------------|
| SEC-LLM-001 | LLM output is never executed directly; it is presented as a suggestion. |
| SEC-LLM-002 | LLM-inferred commands pass the same command policy as user-supplied commands. |
| SEC-LLM-003 | LLM output is labelled as `AI_INTERPRETATION` in the UI. |
