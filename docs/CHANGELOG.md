# CHANGELOG.md

## [0.1.0] — 2026-09-08

### Spiral 0 — Project Discovery and Requirements
- Inspected workspace (Linux x86_64, Node 24, Python 3.12, Java 21, no
  Docker/Go/Rust/Ruby).
- Authored 22 documentation files + 8 persistent context files.
- Spiral 0 report (`iterations/spiral-00-discovery.md`).

### Spiral 1 — Application Foundation
- Prisma schema (17 models), pushed to SQLite.
- Cybersecurity design tokens (severity + signal palette, cyber-grid
  background).
- Sidebar (18 nav items in 4 groups), top bar, command palette (⌘K),
  global search (⌘/).
- Zustand store + TanStack Query.

### Spiral 2 — Project Registry
- POST/GET/PATCH/DELETE `/api/projects` with path verification,
  allowed-root check, symlink detection, duplicate rejection.
- Status machine: REGISTERED → DISCOVERED → VERIFIED → RUNNING →
  STOPPED / FAILED.
- Audit event for every state change.
- ProjectsView grid + ProjectDetailView with 7 tabs.

### Spiral 3 — Project Discovery Engine
- Parses package.json, pyproject.toml, requirements.txt, go.mod,
  Cargo.toml, Gemfile, composer.json, Dockerfile, compose, .env.example,
  Makefile.
- Every non-UNKNOWN field backed by evidence.
- Conflicts recorded, not silently resolved.

### Spiral 4 — README Intelligence Engine
- Parses README.md/.rst/.txt; extracts install/build/run/test/dev/docker
  commands.
- Cross-checks against package.json scripts, file existence, Makefile
  targets, Dockerfile presence.
- Confidence HIGH if cross-check passes, LOW if conflict, MEDIUM
  otherwise.

### Spiral 5 — Safe Project Runner + WS Mini-Service
- 6 runners (Node, Python, Go, Rust, Docker, Shell) with `supported`
  flag.
- Spawn with argv (shell: false); per-command timeout; SIGTERM + SIGKILL.
- `mini-services/proc-ws` on port 3003 with `bun --hot` and socket.io.
- Browser subscribes via `io('/', { query: { XTransformPort: '3003' } })`.

### Spiral 6 — Process Management UI
- RunningProjectsView with live status, stop/restart/health actions.

### Spiral 7 — Health Checks & Logging
- Process/port/HTTP probe.
- Real-time log streaming via WS.
- 14 secret-redaction patterns applied before persistence and emit.

### Spiral 8 — Cybersecurity Knowledge Center
- 50 tools seeded (DAST, SAST, container, SBOM, IaC, K8s, secrets,
  mobile, SIEM, forensics, malware, network, OSINT, threat intel,
  identity, PKI, RE).
- ToolsView with search + category filter.

### Spiral 9 — CVE & Vulnerability Intelligence
- OSV.dev (packages) + NVD (CVE IDs).
- DataSource freshness tracking.
- CvesView + VulnerabilitiesView.

### Spiral 10 — OWASP Knowledge System
- 30 entries: Web 2021 (A01-A10), API 2023 (API1-API10), LLM 2025
  (LLM01-LLM10).
- Each entry links to the official OWASP URL.

### Spiral 11 — AI & LLM Security Center
- 15 entries: prompt injection, indirect prompt injection, jailbreak,
  data leakage, output handling, tool use, agents, RAG, supply chain,
  data poisoning, model theft, adversarial inputs, DoS, identity,
  oversight.

### Spiral 12 — Scanner Plugin Architecture
- Dependency, Secret, Configuration scanners.
- `POST /api/projects/[id]/scan` with `{ scanners: string[] }`.
- `FindingsView` aggregates findings across all projects.

### Spiral 15 — Compliance-Readiness System
- GDPR (10), NIS2 (5), CRA (4), DORA (5), EU AI Act (7) — 31 controls.
- Per-control applicability + status editors.
- Compliance disclaimer prominent on every compliance page.

### Spiral 16 — Security Hardening
- Append-only audit trail.
- 14 secret-redaction patterns.
- scripts/security-test.ts (13 cases pass).
- scripts/redact-test.ts (7 cases pass).

### Spiral 17 — Production Readiness
- Agent-browser self-verification.
- Lint passes (0 errors).
- All 30 acceptance steps from master instruction section 95
  demonstrated with evidence.

### Known Limits (clearly labelled in UI)
- NextAuth dependencies present but not activated (single-user
  local-first scope).
- Direct threat-intel feed not integrated (ThreatIntelView is a
  documented placeholder).
- AI Agent Orchestration dispatch is read-only (AiAgentsView shows the
  9 roles; all roles played by the main agent in this session).
- Secondary AI Verification protocol documented and states applied, but
  no separate second-LLM dispatch.
