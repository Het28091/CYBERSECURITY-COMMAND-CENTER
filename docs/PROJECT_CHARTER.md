# Project Charter — Cybersecurity Command Center

**Version:** 1.0
**Date:** 2026-09-08
**Status:** ACTIVE
**Spiral:** 0

## 1. Mission

Build a local-first Cybersecurity Command Center that acts as the central
dashboard through which a single security engineer or small team can:

- Register, discover, run, monitor, and stop **owned local projects**.
- Analyse README and project manifests to infer safe startup commands with
  explicit evidence and confidence.
- Browse a verified catalogue of cybersecurity tools, OWASP knowledge,
  AI/LLM security concepts, and EU compliance-readiness controls.
- Run authorised, scoped security analysis workflows against registered
  projects.
- Maintain an auditable, evidence-backed trail of every significant action.

## 2. In Scope

- A Next.js 16 + TypeScript single-page web application running locally.
- Real filesystem-backed project discovery and README intelligence.
- Safe, project-scoped command execution for local projects.
- A plugin scanner architecture with at least dependency, secret, and
  configuration scanners implemented.
- A cybersecurity knowledge base seeded from authoritative sources, with
  explicit freshness/verification metadata and offline-first behaviour.
- An OSV.dev / NVD-backed vulnerability lookup with freshness tracking.
- A compliance-readiness control catalogue (GDPR, NIS2, CRA, DORA, EU AI Act)
  with **no legal compliance claims**.
- An audit trail for every state-changing action.

## 3. Out of Scope

- Production cloud deployment and multi-tenant SaaS.
- Legal advice or certification of any kind.
- Active offensive operations against unauthorised targets.
- Hard-coded CVE database (real external lookup is used instead).
- Hard-coded OWASP / AI security content that claims official status without
  a source reference.
- Mobile or desktop native builds (web only).

## 4. Success Criteria (Evidence-Based)

The Command Center is "done for this session" when, in a single running
`/` page, a user can:

1. Open the dashboard and see real status of running projects, recent audit
   events, and active data sources.
2. Add a local project by selecting a directory and have the system **verify
   the location**, **discover** technologies from real manifest files, and
   **parse the README** for commands with confidence + evidence.
3. Start a registered project with command validation, dry-run, real process
   spawning, real-time log streaming over WebSocket, and a real health probe.
4. Stop, restart, view logs of, and verify the health of running projects.
5. Run a dependency/secret/configuration scan against a registered project and
   see real findings (not invented).
6. Browse a real catalogue of cybersecurity tools with verified metadata.
7. Search CVEs via real OSV.dev API integration, with freshness and source
   labels.
8. Browse OWASP and AI/LLM security knowledge entries, each labelled with
   source, verification status, and freshness.
9. Browse GDPR / NIS2 / CRA / DORA / EU AI Act controls with applicability
   assessments and the compliance disclaimer.
10. View an audit trail of every significant action the user took in this
    session.

## 5. Guiding Principles

1. **Evidence over assertion.** Every claim is backed by a source, a file,
   or an executable check.
2. **Secure failure over unsafe convenience.** When in doubt, refuse to
   execute and ask.
3. **No fabrication.** Use `UNKNOWN`, `UNVERIFIED`, `NO DATA AVAILABLE`,
   `STALE` instead of invented values.
4. **Modular architecture.** Discovery, runner, scanners, knowledge, and
   compliance are independent modules.
5. **Local-first.** All core project-management features work offline. Only
   vulnerability lookup and freshness checks require external calls.
6. **Auditability.** Every state-changing action is recorded with actor,
   action, object, result, and timestamp.

## 6. Constraints (This Environment)

- Linux x86_64 sandbox, Node 24, Python 3.12, Java 21, Git available.
- **Docker is NOT available** — Docker-based runners are stubbed with a clear
  "DOCKER UNAVAILABLE" status, not silently skipped.
- No Go, Rust, or Ruby runtimes — those runners are documented as
  "NOT INSTALLED" but the architecture supports them.
- Single externally exposed port (3000 via Next.js; 3003 via WebSocket
  mini-service proxied through Caddy using `XTransformPort`).
- User sees only the `/` route — the entire UI lives in `src/app/page.tsx`
  with client-side view switching.
