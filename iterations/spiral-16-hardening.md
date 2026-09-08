# Spiral 16 — Security Hardening

**Spiral:** 16  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Audit trail, secret redaction, security tests, and the security pillar
review.

## Requirements Addressed
FR-130 to FR-132, SEC-AUD-001 to SEC-AUD-004, SEC-SEC-001 to SEC-SEC-004.

## Implementation
- Audit trail (`src/lib/cyber/audit/record.ts`):
  - Every state-changing API route records an `AuditEvent`.
  - Records: ts, actor, action, objectType, objectId, result,
    reason, metadata (redacted), projectId.
  - Append-only — no update or delete API.
  - AuditView: filter by action/objectType, descending time order.
- Secret redaction (`src/lib/cyber/security/redact.ts`):
  - 14 patterns (AWS, GitHub, Slack, Stripe, JWT, private keys, generic
    assignments, Bearer, URL basic auth, hex-after-key).
  - Applied at:
    - Process manager before persisting stdout/stderr.
    - Process manager before emitting to WS.
    - Audit record before persisting metadata.
    - API responses that may include env vars or logs.
- Security tests:
  - `scripts/security-test.ts`: 13 cases pass (path traversal, symlink
    escape, command block-list, allow-list, shell wrapper, etc.).
  - `scripts/redact-test.ts`: 7 cases pass.

## Tests
- Audit events visible in the Audit view: project.add, project.discover,
  project.readme, project.run (with pid), project.stop, scan.start,
  scan.complete, cve.query, datasource.refresh, etc.
- Browser: Audit view shows real events with timestamps and reasons.

## Acceptance: ACCEPTED. Next: Spiral 17 (Production Readiness).
