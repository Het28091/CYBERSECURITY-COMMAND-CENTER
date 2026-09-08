# Spiral 7 — Health Checks & Logging

**Spiral:** 7  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Probe process status, port availability, HTTP endpoint. Capture and
view logs with redaction.

## Requirements Addressed
FR-060 to FR-065.

## Implementation
- `GET /api/projects/[id]/health` probes:
  - Process: alive/dead via the process manager.
  - Ports: TCP connect to 127.0.0.1:port for each discovered port.
  - HTTP: GET against `healthEndpoint` (if configured) or `http://127.0.0.1:<first-port>/`.
- Distinguishes STARTED / RUNNING / HEALTHY / DEGRADED.
- `GET /api/projects/[id]/logs` paginated; redaction applied.
- `LogsView` and `ProjectDetailView.LogsTab` show real-time logs via
  WebSocket subscription.
- Secret redaction pipeline applied at the process manager before any
  line is persisted or sent to the browser.

## Tests
- scripts/redact-test.ts (7 cases pass): AWS key, GitHub PAT, private
  key block, JWT, generic api_key=, URL basic auth, plain text.
- LogsView correctly shows "[REDACTED:...]" instead of raw secrets.
- Health endpoint distinguishes process-alive vs port-open vs http-ok.

## Acceptance: ACCEPTED. Next: Spiral 8 (Knowledge Center).
