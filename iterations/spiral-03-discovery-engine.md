# Spiral 3 — Project Discovery Engine

**Spiral:** 3  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Detect language, framework, package manager, entry point, ports, env vars,
and container configuration from real project files. Every non-UNKNOWN
field is backed by evidence.

## Requirements Addressed
FR-010 to FR-017 (language, framework, package manager, entry points,
container, ports, env vars, no hallucination).

## Implementation
- `src/lib/cyber/discovery/engine.ts` reads (never executes):
  - `package.json` (Node/JS/TS, framework detection, scripts, ports).
  - `pyproject.toml` / `requirements.txt` (Python + frameworks).
  - `go.mod` (Go + frameworks).
  - `Cargo.toml` (Rust + frameworks).
  - `Gemfile` (Ruby + frameworks).
  - `composer.json` (PHP + frameworks).
  - `Dockerfile` (EXPOSE ports).
  - `docker-compose.yml` / `compose.yml` (port mappings).
  - `.env.example` (env var inventory).
  - `Makefile` (targets).
  - README presence + path.
- Outputs `DiscoverySnapshot` with `evidence: Record<field, file[]>`.
- Conflicts between manifests and README are recorded, not silently
  resolved.
- `POST /api/projects/[id]/discover` persists the snapshot and updates
  the project row.

## Tests
- Node project (proc-ws-test): language=javascript, packageManager=bun.
- Python project (py-test): language=python, framework=FastAPI,
  packageManager=pip, entryPoint=`python app.py`, techStack=[FastAPI,
  Pydantic, uvicorn].
- No fabricated fields: when no manifest is found, fields are UNKNOWN.

## Acceptance: ACCEPTED. Next: Spiral 4 (README Intelligence).
