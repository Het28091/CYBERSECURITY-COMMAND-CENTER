# DATA_MODEL.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

The full Prisma schema lives at `prisma/schema.prisma`. This document is a
human-readable summary; the schema is the source of truth.

## Entities

### Project
Registry entry for a local project.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String | Required |
| description | String? | |
| category | String? | e.g. `web`, `api`, `mobile`, `infra` |
| tags | String | JSON-encoded array |
| localPath | String | Canonical, verified |
| repoUrl | String? | |
| gitBranch | String? | |
| language | String? | Discovered |
| framework | String? | Discovered |
| packageManager | String? | Discovered |
| techStack | String | JSON array |
| readmePath | String? | Discovered |
| entryPoint | String? | Discovered |
| runCommand | String? | Inferred + validated |
| stopCommand | String? | |
| buildCommand | String? | |
| testCommand | String? | |
| healthEndpoint | String? | |
| ports | String | JSON array of numbers |
| envVars | String | JSON object (names → required flag) |
| status | String | Project state machine value |
| health | String | Health state machine value |
| verificationStatus | String | UNVERIFIED / VERIFYING / VERIFIED / FAILED |
| lastVerificationAt | DateTime? | |
| lastRunAt | DateTime? | |
| lastSuccessfulRunAt | DateTime? | |
| lastFailureAt | DateTime? | |
| notes | String? | |
| securityClassification | String? | |
| complianceRelevance | String | JSON array |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### ProjectDiscovery
Latest discovery snapshot per project.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| projectId | String | FK |
| snapshot | String | JSON |
| createdAt | DateTime | |

### ReadmeInference
Inferred commands + cross-check results.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| projectId | String | FK |
| path | String | README file path |
| commands | String | JSON array of {kind, command, confidence, evidence, source, conflict} |
| rendered | String? | Rendered HTML/markdown |
| createdAt | DateTime | |

### ProjectExecution
Every run/stop/restart event.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| projectId | String | FK |
| action | String | run/stop/restart/verify |
| command | String | Resolved command |
| pid | Int? | |
| exitCode | Int? | |
| status | String | Terminal state |
| reason | String? | Failure reason |
| startedAt | DateTime | |
| endedAt | DateTime? | |

### ProjectLog
Incremental log lines (capped per project).

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| projectId | String | FK |
| executionId | String? | FK |
| stream | String | stdout/stderr/event |
| line | String | Redacted |
| ts | DateTime | |

### ScanRun
A scan execution.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| projectId | String | FK |
| scanner | String | e.g. `dependency`, `secret`, `config` |
| status | String | running/completed/failed |
| startedAt | DateTime | |
| endedAt | DateTime? | |
| summary | String? | JSON |

### ScanFinding
A single finding from a scan.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| scanRunId | String | FK |
| projectId | String | FK (denormalised for filtering) |
| scanner | String | |
| severity | String | critical/high/medium/low/info |
| rule | String | |
| title | String | |
| description | String | |
| evidence | String | File path + line / matched text (redacted) |
| confidence | String | high/medium/low |
| createdAt | DateTime | |

### SecurityTool
Cybersecurity tool catalogue.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| name | String | |
| category | String | |
| purpose | String | |
| platforms | String | JSON array |
| input | String? | |
| output | String? | |
| license | String? | |
| officialUrl | String | |
| officialSource | String | e.g. `https://owasp.org/www-community/...` |
| verificationStatus | String | verified/unverified |
| lastVerifiedAt | DateTime? | |
| tags | String | JSON array |

### OwaspEntry
OWASP knowledge entry.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| list | String | e.g. `web-2021`, `api-2023`, `mobile-2024`, `llm-2025` |
| rank | String | e.g. `A01` |
| name | String | |
| summary | String | |
| mitigations | String | JSON array |
| officialUrl | String | |
| verificationStatus | String | |
| lastVerifiedAt | DateTime? | |

### AiSecurityEntry
AI / LLM security concept entry.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| category | String | prompt-injection / rag / supply-chain / agents / ... |
| name | String | |
| summary | String | |
| mitigations | String | JSON array |
| officialUrl | String | |
| verificationStatus | String | |
| lastVerifiedAt | DateTime? | |

### ComplianceFramework
Top-level compliance framework.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| code | String | GDPR / NIS2 / CRA / DORA / EU-AI-ACT |
| name | String | |
| kind | String | law / regulation / directive / standard |
| officialUrl | String | |
| verificationStatus | String | |
| lastVerifiedAt | DateTime? | |

### ComplianceControl
A single control under a framework.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| frameworkId | String | FK |
| code | String | e.g. `GDPR-32-1` |
| title | String | |
| description | String | |
| applicability | String | APPLICABLE / POSSIBLY_APPLICABLE / NOT_APPLICABLE / REVIEW_REQUIRED / UNKNOWN |
| evidence | String? | JSON |
| status | String | gap / partial / met / unknown |
| lastReviewedAt | DateTime? | |

### AuditEvent
Append-only audit trail.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| ts | DateTime | |
| actor | String | `local-user` for now |
| action | String | e.g. `project.add`, `project.run`, `project.stop` |
| objectType | String | project / scan / settings / ... |
| objectId | String? | |
| result | String | success / failure |
| reason | String? | |
| metadata | String | JSON, post-redaction |

### DataSource
External source freshness tracker.

| Field | Type | Notes |
|-------|------|-------|
| id | String | PK |
| code | String | e.g. `osv-dev`, `nvd`, `owasp-web-2021` |
| name | String | |
| trustTier | Int | 1 / 2 / 3 |
| endpoint | String | |
| lastSuccessAt | DateTime? | |
| lastFailureAt | DateTime? | |
| lastFailureReason | String? | |
| freshness | String | fresh / stale / unknown |
| cachedAt | DateTime? | |

### Settings
Single-row settings table.

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, always 1 |
| allowedProjectRoots | String | JSON array of allowed roots |
| typoCorrection | Boolean | default true |
| bindLocalhost | Boolean | default true |
| maxLogLinesPerProject | Int | default 5000 |
| commandTimeoutMs | Int | default 60000 |
| externalFetchEnabled | Boolean | default true |
| aiAssistanceEnabled | Boolean | default true |
| updatedAt | DateTime | |
