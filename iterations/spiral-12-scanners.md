# Spiral 12 — Scanner Plugin Architecture

**Spiral:** 12  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Common Scanner interface with at least Dependency, Secret, and
Configuration scanners. Findings persisted with severity, evidence, and
confidence.

## Requirements Addressed
FR-110 to FR-115.

## Implementation
- `src/lib/cyber/scanners/scanners.ts` defines `Scanner` interface and
  3 implementations:
  - `dependencyScanner`: parses package.json, requirements.txt,
    Cargo.toml, go.mod. Lists every dependency as an INFO finding with
    its declared version. Flags `*` / `latest` versions as MEDIUM.
  - `secretScanner`: 12 high-signal regex patterns (AWS access key,
    AWS secret, GitHub PAT, Slack token, Stripe key, private key
    block, JWT, generic api_key=, generic secret=, Bearer, URL basic
    auth, generic hex-after-key). Scans up to 200 source files (skips
    node_modules/.git/dist/build/.next/target/vendor/cache). Skips
    obvious placeholder values.
  - `configScanner`: scans .env files for `0.0.0.0` binds, plain
    HTTP for auth-related variables, debug flags; Dockerfile for
    missing USER directive and :latest tags; compose files for
    `0.0.0.0:` port bindings.
- `POST /api/projects/[id]/scan` accepts `{ scanners: string[] }`,
  runs each scanner in sequence, persists findings + scanRun record.
- `GET /api/projects/[id]/findings?severity=&scanner=` for retrieval.
- `FindingsView` aggregates findings across all projects with findings.
- "NO FINDINGS FROM CONFIGURED CHECKS" empty state — never claims
  "PROJECT IS SECURE".
- `GET /api/scanners` lists the catalogue.

## Tests
- Scanned `cyber-test-target` (this Next.js project): 78 findings (76
  dependencies from package.json + 2 medium secret findings from
  source files).
- Scanned `py-test` Python project: 3 files scanned, 0 findings —
  scanners run cleanly even on a minimal project.
- Browser: Findings tab shows all 78 findings with severity pills,
  scanner badges, and source evidence.
- Audit: `scan.start` and `scan.complete` events recorded.

## Acceptance: ACCEPTED. Next: Spiral 15 (Compliance-Readiness).
