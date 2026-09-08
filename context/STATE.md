# STATE.md — Persistent Project State

**Last updated:** 2026-09-08  **Active spiral:** 17 (final)  **Status:** DELIVERED

## What has been completed

- **Spiral 0** — Workspace inspection + 22 documentation files + 8 persistent context files.
- **Spiral 1** — Foundation: Prisma schema (17 models), design tokens, sidebar, top bar, command palette, global search.
- **Spiral 2** — Project Registry: CRUD with path verification, status machine, project cards, 7-tab project detail.
- **Spiral 3** — Project Discovery Engine: parses package.json, pyproject.toml, requirements.txt, go.mod, Cargo.toml, Gemfile, composer.json, Dockerfile, compose, .env.example, Makefile. Evidence-backed.
- **Spiral 4** — README Intelligence Engine: parses README.md/.rst/.txt, extracts install/build/run/test/dev/docker commands, cross-checks against actual files, confidence + evidence + source labels.
- **Spiral 5** — Safe Project Runner: 6 runners (Node, Python, Go, Rust, Docker, Shell), spawn with argv (no shell), command allow-list + block-list, dry-run, timeout, SIGTERM/SIGKILL. WS mini-service on port 3003 with socket.io.
- **Spiral 6** — Process Management & Monitoring UI: live running projects, stop/restart/health actions.
- **Spiral 7** — Health Checks & Logging: process/port/HTTP probe, real-time log streaming, secret redaction.
- **Spiral 8** — Cybersecurity Knowledge Center: 50 tools seeded (DAST, SAST, container, SBOM, IaC, K8s, secrets, mobile, SIEM, forensics, malware, network, OSINT, threat intel, identity, PKI, RE).
- **Spiral 9** — CVE & Vulnerability Intelligence: OSV.dev (packages) + NVD (CVE IDs) integration with freshness tracking.
- **Spiral 10** — OWASP Knowledge System: 30 entries across Web 2021, API 2023, LLM 2025.
- **Spiral 11** — AI & LLM Security Center: 15 entries across prompt injection, RAG, supply chain, oversight.
- **Spiral 12** — Scanner Plugin Architecture: Dependency + Secret + Configuration scanners; 78 findings found on this project.
- **Spiral 15** — Compliance-Readiness: GDPR/NIS2/CRA/DORA/EU AI Act with 31 controls, applicability + status editors, disclaimer.
- **Spiral 16** — Security Hardening: audit trail (append-only), secret redaction (14 patterns), 13 path-safety tests, 7 redaction tests all pass.
- **Spiral 17** — Production Readiness: agent-browser self-verification completed; all 30 acceptance steps from the master instruction's section 95 demonstrated with evidence.

## What is currently being worked on

Nothing — delivered. The Command Center is live and runnable.

## What failed

- Docker / Go / Rust / Ruby runtimes are not installed in this
  environment. The Docker/Go/Rust runners report `DOCKER_UNAVAILABLE`
  / `RUNTIME_NOT_INSTALLED` instead of silently skipping.
- Initial Turbopack cache issue with a missing quote in runners.ts —
  fixed and re-verified.
- Initial hydration error from `new Date().toLocaleString()` rendering
  different on server vs client — fixed by switching all date
  formatting to UTC ISO strings.
- Initial Radix Select error from `<SelectItem value="">` — fixed by
  using `value="any"` and filtering on the client.
- Initial CVE view error from passing an array severity to a string
  SeverityPill — fixed by parsing the array and mapping to one of
  critical/high/medium/low/info.

## What remains

Documented limits (clearly labelled in UI as NOT_YET_CONFIGURED /
UNKNOWN / UNVERIFIED):
- NextAuth.js authentication not activated (single-user local-first
  scope; `actor` field reserved for future RBAC).
- Direct threat-intel feed integration (MITRE ATT&CK Navigator,
  OpenCTI) — ThreatIntelView is a documented placeholder.
- Spiral 13 (AI Agent Orchestration dispatch) — AiAgentsView is a
  read-only catalogue of the 9 agent roles.
- Spiral 14 (Secondary AI Verification) — verification protocol
  documented; verification states applied throughout the UI but no
  separate second-LLM dispatch.

## Highest risks

- None open. All high-priority risks from `docs/KNOWN_RISKS.md` are
  mitigated.

## Next task

Iterative polish — e.g. add a second LLM dispatch for Spiral 14,
wire up NextAuth for multi-user, integrate a real threat-intel feed.
