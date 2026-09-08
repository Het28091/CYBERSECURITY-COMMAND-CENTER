# Spiral 4 — README Intelligence Engine

**Spiral:** 4  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Parse README files, extract install/build/run/test/dev/docker commands,
cross-check them against actual project files, and assign confidence +
evidence + source labels.

## Requirements Addressed
FR-020 to FR-024 (parse, extract, cross-check, confidence, conflicts).

## Implementation
- `src/lib/cyber/readme/engine.ts` parses README.md/.rst/.txt.
- Extracts fenced code blocks (```bash etc.) and identifies shell
  commands by executable name (npm, python, docker, make, go, cargo, ...).
- Classifies commands: install / build / run / test / dev / docker / env.
- Cross-checks:
  - `npm run X` → package.json scripts.X must exist.
  - `python app.py` → app.py must exist.
  - `docker compose up` → Dockerfile or compose file must exist.
  - `make X` → Makefile must contain a `X:` target.
  - `go run` → go.mod + main.go must exist.
  - `cargo run` → Cargo.toml + src/main.rs must exist.
- Confidence: HIGH if cross-check passes; LOW if conflict; MEDIUM
  otherwise. README-only commands start at MEDIUM.
- Records conflicts in `result.conflicts[]` and per-command `conflict`
  field.
- `POST /api/projects/[id]/readme` persists the inference.

## Tests
- py-test README: `python app.py` → verified HIGH (app.py exists).
- py-test README: `pip install -e .` → MEDIUM (no manifest to verify).
- py-test README: `pytest` → run as test, MEDIUM.

## Acceptance: ACCEPTED. Next: Spiral 5 (Safe Project Runner).
