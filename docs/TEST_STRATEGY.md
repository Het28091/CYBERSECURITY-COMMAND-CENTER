# TEST_STRATEGY.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Layers

| Layer | Tooling | Coverage Target |
|-------|---------|-----------------|
| Pure logic (path safety, command policy, redaction, discovery, README parser, scanners) | `bun test` with native TypeScript | High — security-critical modules. |
| API routes | Real Next.js route invocation via `bun test` | Happy + failure paths per route. |
| Runner | Spawn dry-run + real short-lived process | Lifecycle + safety. |
| UI | Manual + agent-browser self-verification per skill | Golden path. |

## 2. Security Test Cases (Required)

| ID | Case |
|----|------|
| ST-001 | Path traversal: `..` segments rejected. |
| ST-002 | Symlink escape: symlinked path outside root rejected. |
| ST-003 | Command block-list: `rm -rf /` rejected. |
| ST-004 | Command allow-list: `nonsense-binary-xyz` rejected. |
| ST-005 | Working dir override: client-supplied cwd ignored. |
| ST-006 | Timeout: long-running process killed. |
| ST-007 | Graceful shutdown: SIGTERM respected. |
| ST-008 | Force shutdown: SIGKILL fallback. |
| ST-009 | Secret redaction: API key patterns stripped from logs. |
| ST-010 | Validation: invalid request bodies rejected. |

## 3. Discovery Test Cases

| ID | Case |
|----|------|
| DT-001 | Node project (package.json) → language=javascript, packageManager=npm. |
| DT-002 | Next.js framework detected from package.json deps. |
| DT-003 | Python project (pyproject.toml) → language=python. |
| DT-004 | FastAPI detected from pyproject deps. |
| DT-005 | Dockerfile detected → container config present. |
| DT-006 | .env.example parsed into env var list. |
| DT-007 | Unknown manifest → UNKNOWN fields, no fabrication. |

## 4. README Intelligence Test Cases

| ID | Case |
|----|------|
| RT-001 | `npm run dev` cross-checked against package.json scripts. |
| RT-002 | `python app.py` cross-checked against app.py existence. |
| RT-003 | `docker compose up` cross-checked against compose file. |
| RT-004 | Missing README → no inferences, status NO_README. |
| RT-005 | README contradicts manifest → conflict recorded, confidence LOW. |

## 5. Runner Test Cases

| ID | Case |
|----|------|
| PT-001 | Missing directory → graceful failure. |
| PT-002 | Invalid command → graceful failure. |
| PT-003 | Port already in use → reported. |
| PT-004 | Process crash → exit code recorded. |
| PT-005 | Dry-run → no process spawned, command printed. |
| PT-006 | Stop → SIGTERM then SIGKILL. |

## 6. Verification

A spiral is "verified" when:

- All P0 test cases pass.
- `bun run lint` passes.
- The dev server is running without errors.
- The golden-path UI flow works in the agent-browser self-verification.
