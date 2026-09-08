# REQUIREMENTS.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Status:** ACTIVE  **Spiral:** 0

This document defines the requirements for the Cybersecurity Command Center.
Every requirement has a stable identifier so it can be traced to
implementation and tests.

---

## 1. Project Goals

| ID | Goal |
|----|------|
| G-001 | Provide a single local-first dashboard for managing cybersecurity projects. |
| G-002 | Replace guesswork with evidence-based inference of how a project runs. |
| G-003 | Make project execution safe by enforcing scope, validation, and dry-runs. |
| G-004 | Give the user verified cybersecurity knowledge, not fabricated content. |
| G-005 | Provide compliance-readiness support without claiming legal compliance. |
| G-006 | Maintain an auditable trail of every significant action. |

## 2. Functional Requirements

### 2.1 Project Registry

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Register a project by local path. | P0 |
| FR-002 | Verify the directory exists and is canonical. | P0 |
| FR-003 | Reject paths outside the allowed project roots. | P0 |
| FR-004 | Detect symlinks and resolve real paths. | P0 |
| FR-005 | Store project metadata (name, category, tags, language, framework, ports, env). | P0 |
| FR-006 | List, filter, sort, and search registered projects. | P1 |
| FR-007 | Edit and delete projects (with confirmation). | P1 |
| FR-008 | Record project state machine transitions. | P0 |

### 2.2 Project Discovery Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010 | Detect language from manifest files (Python, Node, Go, Rust, Java, PHP, Ruby). | P0 |
| FR-011 | Detect framework from package manifests (Next.js, Express, FastAPI, Django, Flask, Rails, Spring). | P1 |
| FR-012 | Detect package manager (npm, yarn, pnpm, pip, poetry, pipenv, cargo, go mod, mvn). | P1 |
| FR-013 | Detect entry points (main.py, index.js, server.js, app.py, main.go, Cargo.toml [[bin]]). | P1 |
| FR-014 | Detect container configuration (Dockerfile, compose.yml). | P1 |
| FR-015 | Detect ports from env files, README, and source. | P2 |
| FR-016 | Detect env variables from .env.example. | P2 |
| FR-017 | Never hallucinate a discovery; mark unknown fields as `UNKNOWN`. | P0 |

### 2.3 README Intelligence Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-020 | Parse README.md / README.rst / README.txt. | P0 |
| FR-021 | Extract install, build, run, test, and dev commands from README. | P0 |
| FR-022 | Cross-check README commands against real project files. | P0 |
| FR-023 | Assign HIGH / MEDIUM / LOW confidence with evidence. | P0 |
| FR-024 | Record conflicts between README and actual files. | P0 |
| FR-025 | Render the README in the UI. | P1 |

### 2.4 Safe Project Runner

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-030 | Validate command, working directory, executable, and arguments. | P0 |
| FR-031 | Enforce project-scoped working directory. | P0 |
| FR-032 | Block disallowed executables (rm -rf /, dd, mkfs, etc.). | P0 |
| FR-033 | Resolve canonical paths before execution. | P0 |
| FR-034 | Capture stdout, stderr, exit code, and pid. | P0 |
| FR-035 | Track child processes. | P1 |
| FR-036 | Support dry-run mode (no actual execution). | P0 |
| FR-037 | Support graceful and forced shutdown. | P0 |
| FR-038 | Apply per-command timeout. | P0 |
| FR-039 | Detect orphan processes on shutdown. | P2 |
| FR-040 | Mark Docker runner as unavailable when Docker is missing. | P0 |

### 2.5 Process Management & Monitoring

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-050 | List running projects with live status. | P0 |
| FR-051 | Stream logs over WebSocket in real time. | P0 |
| FR-052 | Stop and restart running projects. | P0 |
| FR-053 | Surface process state transitions. | P0 |

### 2.6 Health & Logging

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-060 | Probe process status. | P0 |
| FR-061 | Probe port availability. | P0 |
| FR-062 | Probe HTTP health endpoint. | P0 |
| FR-063 | Distinguish STARTED / RUNNING / HEALTHY. | P0 |
| FR-064 | Capture and search project logs. | P0 |
| FR-065 | Redact obvious secrets in logs. | P1 |

### 2.7 Cybersecurity Knowledge Center

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-070 | Catalogue cybersecurity tools with name, category, purpose, license, official source. | P1 |
| FR-071 | Search tools by name, category, tag. | P1 |
| FR-072 | Never fabricate tool capabilities. | P0 |
| FR-073 | Display source verification status for every entry. | P0 |

### 2.8 Vulnerability Center

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-080 | Query OSV.dev API by package ecosystem + name. | P0 |
| FR-081 | Query by CVE ID. | P1 |
| FR-082 | Display severity, affected versions, fixed versions, references. | P0 |
| FR-083 | Track source, retrieval time, and freshness. | P0 |
| FR-084 | Cache responses to remain usable offline. | P1 |
| FR-085 | Mark stale data clearly. | P0 |

### 2.9 OWASP Knowledge Center

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-090 | Provide OWASP Top 10 entries for Web, API, Mobile, LLM. | P1 |
| FR-091 | Each entry has name, description, source URL, verification status, freshness. | P0 |
| FR-092 | Never present invented content as official. | P0 |

### 2.10 AI / LLM Security Center

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-100 | Cover prompt injection, indirect prompt injection, jailbreak, sensitive disclosure, insecure output, insecure tool use, excessive agency, RAG security, model supply chain, data poisoning, model theft, adversarial inputs, AI DoS. | P1 |
| FR-101 | Each concept has source reference and verification status. | P0 |

### 2.11 Scanner Plugin Architecture

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-110 | Common Scanner interface. | P0 |
| FR-111 | DependencyScanner (parses package manifests, lists deps with versions). | P0 |
| FR-112 | SecretScanner (regex-based high-signal patterns with redaction). | P0 |
| FR-113 | ConfigurationScanner (env, docker, compose, IaC basics). | P1 |
| FR-114 | Persist findings with severity and evidence. | P0 |
| FR-115 | Never claim "PROJECT IS SECURE"; use "NO FINDINGS FROM CONFIGURED CHECKS". | P0 |

### 2.12 Compliance-Readiness System

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-120 | Catalogue GDPR, NIS2, CRA, DORA, EU AI Act controls. | P1 |
| FR-121 | Mark applicability per framework (APPLICABLE / POSSIBLY_APPLICABLE / NOT_APPLICABLE / REVIEW_REQUIRED / UNKNOWN). | P1 |
| FR-122 | Allow evidence attachment. | P2 |
| FR-123 | Display the compliance disclaimer on every compliance page. | P0 |
| FR-124 | Never claim legal compliance. | P0 |

### 2.13 Audit Trail

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-130 | Record every state-changing action with timestamp, actor, action, object, result. | P0 |
| FR-131 | Display audit events in a searchable log. | P1 |
| FR-132 | Never record secrets. | P0 |

### 2.14 Global UX

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-140 | Command palette (Cmd+K) for global actions. | P1 |
| FR-141 | Global search across projects, tools, CVEs, OWASP entries, audit events. | P1 |
| FR-142 | Typo correction for natural-language input only (never for paths, CVE IDs, package names). | P2 |
| FR-143 | Dark-first cybersecurity aesthetic. | P1 |
| FR-144 | Responsive layout (mobile, tablet, desktop). | P1 |
| FR-145 | Accessible (keyboard nav, ARIA, focus visibility, non-colour-only status). | P1 |

## 3. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | All core project-management features must work offline. |
| NFR-002 | External data sources display retrieval time, source URL, and freshness. |
| NFR-003 | The UI must remain responsive with 200+ projects and 5000+ findings (pagination, virtualization). |
| NFR-004 | API requests use relative paths only; WebSocket uses `XTransformPort` query param. |
| NFR-005 | No secrets are written to disk unencrypted, never logged. |
| NFR-006 | All API routes validate input with Zod. |
| NFR-007 | All database writes use Prisma migrations / pushes. |
| NFR-008 | Lint must pass (`bun run lint`). |

## 4. Security Requirements

See `SECURITY_REQUIREMENTS.md` and `THREAT_MODEL.md` for the full security
requirements catalog. Highlights:

| ID | Requirement |
|----|-------------|
| SEC-001 | Path traversal protection on every project path. |
| SEC-002 | Symlink escape protection. |
| SEC-003 | Command allow-list + block-list before execution. |
| SEC-004 | Per-command timeout. |
| SEC-005 | Project-scoped working directory; cannot escape. |
| SEC-006 | Audit logging of every state-changing action. |
| SEC-007 | Secret redaction in logs. |
| SEC-008 | No external network exposure by default (local-only binding). |
| SEC-009 | Input validation (Zod) on every API route. |
| SEC-010 | Authorization check stub on every sensitive endpoint. |

## 5. Privacy Requirements

| ID | Requirement |
|----|-------------|
| PRIV-001 | Data minimization: do not store secrets or credentials. |
| PRIV-002 | Logs do not include secrets (regex redaction). |
| PRIV-003 | `.env.example` documents required env variables. |
| PRIV-004 | Exports exclude secrets. |

## 6. Acceptance Criteria

The session is acceptable when all P0 requirements are demonstrated with
evidence in the running application and the spiral report.

## 7. Assumptions

- The user owns the projects they register.
- The user has read access to the filesystem.
- The sandbox does not allow external network exposure except via Caddy.
- Docker is not installed in this environment.

## 8. Out of Scope (This Session)

- Multi-user authentication and RBAC enforcement (architecture is prepared).
- Active offensive scanning against external targets.
- Legal compliance certification.
- Cloud deployment automation.
