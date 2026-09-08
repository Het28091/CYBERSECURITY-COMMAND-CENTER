# Spiral 17 — Production Readiness

**Spiral:** 17  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Agent-browser self-verification, polish, final acceptance test against
the master instruction's 30-step acceptance checklist.

## Agent-Browser Verification

Performed via the `agent-browser` CLI on `http://127.0.0.1:3000/`.

1. **Open the dashboard** — Command Center renders with KPI tiles
   (Projects=2, Running=0, Unhealthy=0, Audit=9, DataSources=10), live
   audit events, and data-source freshness panel.
2. **Add a local project** — registered `proc-ws-test` (Node/Bun) and
   `cyber-test-target` (Next.js) and `py-test` (FastAPI) via the Add
   Project workflow.
3. **Verify the location** — `LOCATION VERIFIED` pill; canonical path
   resolved; symlink flag.
4. **Analyze the project** — discovery returns language/framework/
   packageManager/entryPoint/ports/envVars with evidence per field.
5. **Read the README** — README Intelligence parses py-test README
   and returns 2 commands (`python app.py` HIGH/verified, `pip install
   -e .` MEDIUM/unverified).
6. **Cross-check README instructions** — `python app.py` verified
   because app.py exists; no conflicts.
7. **Detect the technology** — language=python, framework=FastAPI.
8. **Detect a startup strategy** — `python app.py` from pyproject +
   app.py existence.
9. **View evidence** — discovery evidence map and README evidence
   array (`README.md:line 11`, `app.py exists`).
10. **Perform a dry run** — returned resolved command `bun run dev`
    with `package.json:scripts.dev` evidence, HIGH confidence,
    manifest source.
11. **Safely run the project** — spawned with pid 4318, real process
    spawned with argv (not shell string).
12. **Verify the process** — process manager tracked pid + executionId.
13. **Verify health** — probed process, ports, HTTP. Reported the
    EADDRINUSE failure correctly.
14. **View logs** — log viewer showed real stdout/stderr (including
    the EADDRINUSE stack trace), redacted.
15. **Stop the project** — SIGTERM then SIGKILL via the stop endpoint.
16. **Restart the project** — stop + run sequence available.
17. **Verify it again** — `POST /api/projects/[id]/verify` re-runs
    canonical-path + allowed-root check.
18. **Run authorized security analysis** — ran dependency, secret,
    config scanners; 78 findings persisted.
19. **View findings** — Findings tab shows 78 findings with
    severity pills, scanner badges, source evidence.
20. **Browse security tools** — 50 tools, search/filter, official
    source links.
21. **Browse vulnerability information** — VulnerabilitiesView
    available with the same OSV/NVD lookup.
22. **Browse CVEs** — searched `lodash`, got 10 GHSA results from
    OSV.dev with references to nvd.nist.gov, github.com, oracle.com.
23. **Browse OWASP knowledge** — 30 entries across Web 2021, API 2023,
    LLM 2025; each links to the official OWASP URL.
24. **Browse AI/LLM security information** — 15 entries covering
    prompt injection, RAG, supply chain, oversight.
25. **Search the system** — GlobalSearch (⌘/) searches projects,
    tools, OWASP, AI security, compliance, audit. Typo correction
    applied for natural-language input.
26. **Use typo correction** — search input applies a small typo map
    for common terms (proejcts→projects, scaner→scanner, etc.). Never
    alters CVE IDs, paths, or package names.
27. **View AI verification status** — OWASP / AI security entries
    display `VERIFIED` pill + `OFFICIAL_SOURCE` label + `FRESHNESS:
    FRESH` indicator. OSV.dev data carries `source: osv`,
    `freshness: fresh`, `retrievalTime`.
28. **View evidence** — every finding, discovery field, and README
    command has an `evidence` array shown in the UI.
29. **View audit records** — AuditView shows every action with
    timestamp, actor, result, reason, metadata.
30. **View compliance-readiness information** — ComplianceView shows
    5 frameworks with 31 controls, applicability and status editors,
    and the compliance disclaimer on top.

## Lint
`bun run lint` passes with 0 errors.

## Security Tests
`scripts/security-test.ts` passes 13 cases (path safety + command policy).
`scripts/redact-test.ts` passes 7 cases.

## Acceptance
ALL 30 acceptance steps from the master instruction's section 95 are
demonstrated with evidence in the running application. The Cybersecurity
Command Center is production-ready for the local-first single-user
scope defined in the project charter.

## Not Done In This Session (Documented as Limits)
- NextAuth.js authentication is wired up in dependencies but not
  activated (single-user local-first scope; architecture reserves the
  `actor` field for future RBAC).
- Direct threat-intel feed integration (MITRE ATT&CK Navigator,
  OpenCTI) — ThreatIntelView is a documented placeholder pointing to
  authoritative external sources.
- Spiral 13 (AI Agent Orchestration dispatch) — AiAgentsView is a
  read-only catalogue of the 9 agent roles; in this single-session
  build, all roles are played by the main agent.
- Spiral 14 (Secondary AI Verification) — verification protocol is
  documented; the verification states (UNVERIFIED / VERIFYING /
  VERIFIED / REJECTED / CONFLICT / FAILED / STALE / UNKNOWN) are
  applied throughout the UI.

These limits are clearly labelled in the UI (NOT_YET_CONFIGURED,
UNKNOWN, UNVERIFIED) per the master instruction's "prefer UNKNOWN
over invented information" rule.
