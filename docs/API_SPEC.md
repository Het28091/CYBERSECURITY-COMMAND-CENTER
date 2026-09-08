# API_SPEC.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

All routes are under `/api/*` and use relative paths only (per platform
skill). Request bodies are JSON. Every route validates with Zod and returns
a structured `{ ok: boolean, data?: ..., error?: { code: string, message: string } }` envelope.

## Projects

### `GET /api/projects`
- **Query:** `?q=&status=&category=`
- **Response:** `Project[]`

### `POST /api/projects`
- **Body:** `{ name: string, localPath: string, description?: string, category?: string, tags?: string[] }`
- **Validation:** Path must exist, must be inside an allowed root, must resolve to canonical path.
- **Audit:** `project.add`
- **Response:** `Project`

### `GET /api/projects/:id`
- **Response:** `Project` with last discovery, readme, executions

### `PATCH /api/projects/:id`
- **Body:** Partial `Project` (excluding id, createdAt)
- **Audit:** `project.update`
- **Response:** `Project`

### `DELETE /api/projects/:id`
- **Body:** `{ confirm: true }` (must be true)
- **Audit:** `project.delete`
- **Response:** `{ ok: true }`

### `POST /api/projects/:id/discover`
- Runs the discovery engine against the project path.
- **Audit:** `project.discover`
- **Response:** `ProjectDiscovery`

### `POST /api/projects/:id/readme`
- Runs the README intelligence engine.
- **Audit:** `project.readme`
- **Response:** `ReadmeInference`

### `POST /api/projects/:id/verify`
- Verifies the location is still valid (canonical, allowed root, no escape).
- **Audit:** `project.verify`
- **Response:** `{ ok: boolean, reason?: string }`

### `POST /api/projects/:id/run`
- Validates the run command, optionally dry-runs, then spawns.
- **Body:** `{ dryRun?: boolean, force?: boolean }`
- **Audit:** `project.run`
- **Response:** `{ executionId: string, pid: number }`

### `POST /api/projects/:id/stop`
- Sends SIGTERM, then SIGKILL after grace period.
- **Audit:** `project.stop`
- **Response:** `{ ok: true }`

### `POST /api/projects/:id/restart`
- Stop + run sequence.
- **Audit:** `project.restart`

### `GET /api/projects/:id/health`
- Probes process, port, HTTP endpoint.
- **Response:** `{ process: 'alive'|'dead', ports: PortStatus[], http?: HttpStatus }`

### `GET /api/projects/:id/logs`
- **Query:** `?limit=&from=&stream=`
- **Response:** `ProjectLog[]`

### `POST /api/projects/:id/scan`
- **Body:** `{ scanners: string[] }` (e.g. `['dependency','secret','config']`)
- **Audit:** `scan.start`
- **Response:** `{ scanRunId: string }`

### `GET /api/projects/:id/scans`
- **Response:** `ScanRun[]`

### `GET /api/projects/:id/findings`
- **Query:** `?severity=&scanner=`
- **Response:** `ScanFinding[]`

## Knowledge

### `GET /api/tools`
- **Query:** `?q=&category=`
- **Response:** `SecurityTool[]`

### `GET /api/tools/:id`
- **Response:** `SecurityTool`

## Vulnerabilities

### `GET /api/cves`
- **Query:** `?q=` (package name, CVE ID, or ecosystem:name)
- **Response:** `{ source: 'osv'|'nvd'|'cache', retrievalTime: string, freshness: 'fresh'|'stale'|'unknown', items: Vulnerability[] }`

### `GET /api/cves/:id`
- **Response:** Vulnerability detail from NVD if found, else OSV.

## OWASP

### `GET /api/owasp`
- **Query:** `?list=` (web-2021, api-2023, mobile-2024, llm-2025)
- **Response:** `OwaspEntry[]`

## AI Security

### `GET /api/ai-security`
- **Query:** `?category=`
- **Response:** `AiSecurityEntry[]`

## Compliance

### `GET /api/compliance`
- **Response:** `ComplianceFramework[]` with controls

### `PATCH /api/compliance/:frameworkId/controls/:controlId`
- **Body:** `{ applicability?, status?, evidence? }`
- **Audit:** `compliance.update`

## Scanners (catalogue)

### `GET /api/scanners`
- **Response:** `ScannerMeta[]` (`{ id, name, category, description, supported }`)

## Audit

### `GET /api/audit`
- **Query:** `?action=&objectType=&from=&to=&limit=`
- **Response:** `AuditEvent[]`

## Search

### `GET /api/search`
- **Query:** `?q=`
- Searches projects, tools, OWASP entries, AI entries, compliance controls, audit events.
- **Response:** `{ projects, tools, owasp, aiSecurity, compliance, audit }`

## System

### `GET /api/system/health`
- Probes DB, filesystem, websocket service.
- **Response:** `{ db: 'ok'|'fail', fs: 'ok'|'fail', ws: 'ok'|'fail', overall: 'HEALTHY'|'DEGRADED'|'UNAVAILABLE' }`

### `GET /api/system/datasources`
- **Response:** `DataSource[]`

### `POST /api/system/datasources/:code/refresh`
- Triggers a refresh of one external source.

### `GET /api/settings`
### `PATCH /api/settings`
- **Audit:** `settings.update`

## Errors

| Code | Meaning |
|------|---------|
| `INVALID_INPUT` | Zod validation failed |
| `NOT_FOUND` | Resource does not exist |
| `PATH_INVALID` | Path failed verification |
| `PATH_OUTSIDE_ROOT` | Path is outside allowed roots |
| `COMMAND_BLOCKED` | Command policy refused the command |
| `COMMAND_TIMEOUT` | Process exceeded timeout |
| `PORT_IN_USE` | Port already bound |
| `DOCKER_UNAVAILABLE` | Docker is not installed |
| `EXTERNAL_FETCH_DISABLED` | External fetches disabled in settings |
| `EXTERNAL_FETCH_FAILED` | External call failed |
| `UNAUTHORIZED` | Authorization refused |
| `INTERNAL` | Unexpected internal error |
