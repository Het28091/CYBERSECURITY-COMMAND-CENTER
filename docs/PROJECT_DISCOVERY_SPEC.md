# PROJECT_DISCOVERY_SPEC.md

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Inputs

- Canonical project path (already verified against allowed roots).

## 2. File Probes

The discovery engine reads (no execution) the following, if present:

| File | What we extract |
|------|------------------|
| `package.json` | `name`, `scripts`, `dependencies` keys (frameworks), `engines` |
| `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` | package manager identity |
| `pyproject.toml` (TOML parse) | `[project]` name, `[tool.poetry]`, dependencies |
| `requirements.txt` | pip + top-level package list |
| `Pipfile` | pipenv |
| `poetry.lock` | poetry |
| `go.mod` | go module name |
| `Cargo.toml` | rust crate + bins |
| `Gemfile` | ruby + frameworks |
| `composer.json` | php + frameworks |
| `Dockerfile` | container capability; expose ports |
| `docker-compose.yml` / `compose.yml` (YAML parse) | services + ports |
| `Makefile` (line scan) | run/build/test targets |
| `.env.example` | required env var names |
| `README.md` / `README.rst` / `README.txt` | presence + path |
| `src/`, `app/`, `lib/` | directory presence for entry-point heuristics |
| `main.py`, `app.py`, `server.py`, `index.js`, `server.js`, `main.go`, `main.rs`, `Main.java` | entry point |

## 3. Outputs

```ts
interface DiscoverySnapshot {
  language: string | 'UNKNOWN';
  framework: string | 'UNKNOWN';
  packageManager: string | 'UNKNOWN';
  techStack: string[];           // framework + tooling names
  entryPoint: string | 'UNKNOWN';
  containerConfig: { type: 'dockerfile' | 'compose' | 'none'; ports: number[] };
  ports: number[];
  envVars: { name: string; required: boolean }[];
  manifestFiles: string[];       // paths that justified each finding
  conflicts: { field: string; left: string; right: string; source: string }[];
  warnings: string[];
  evidence: Record<string, string[]>; // field → files that justified it
}
```

## 4. Rules

- Every non-`UNKNOWN` field must have ≥1 entry in `evidence`.
- A field with no evidence must be `UNKNOWN`.
- Conflicts between manifests and README are recorded, not silently resolved.
- Ports inferred from README are MEDIUM confidence; ports from Dockerfile/compose
  are HIGH.
- Discovery never executes any project file.

## 5. Caching

Snapshot stored in `ProjectDiscovery` table. Re-discovery overwrites the
latest snapshot but keeps history in `iterations/`.
