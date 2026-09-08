# Spiral 0 — Project Discovery and Requirements

**Spiral:** 0
**Date:** 2026-09-08
**Status:** ACCEPTED
**Author:** main agent

## 1. Objectives

Inspect the workspace, capture requirements, decide architecture, and
bootstrap the persistent project memory before any application code is
written.

## 2. Requirements Addressed

All `G-*` goals and all P0 requirements are documented in `docs/REQUIREMENTS.md`
with stable identifiers traceable to implementation.

## 3. Risks Identified

See `docs/KNOWN_RISKS.md`. Top three:
1. Single-session scope exceeds time budget → prioritise P0.
2. Docker unavailable → DockerRunner reports DOCKER_UNAVAILABLE.
3. LLM hallucination → AI output labelled + command-policy gated.

## 4. Design Decisions

See `context/DECISIONS.md` (D-2026-09-08-001 through 006). Highlights:
- Single-page UI under `/` with client-side view switching.
- Socket.io mini-service on port 3003 for real-time logs.
- OSV.dev (primary) + NVD (by CVE ID) for vulnerabilities.
- Spawn with argv, never shell string.
- AI output always labelled `AI_INTERPRETATION`.
- Docker runner reports unavailability rather than silently skipping.

## 5. Implementation Summary

(no application code yet — this spiral is requirements + design only)

## 6. Tests Executed

(none — no application code yet)

## 7. Test Results

N/A

## 8. Security Review

Threat model and security requirements authored. Path safety, command policy,
redaction, and audit pillars defined. LLM safety rules in place.

## 9. Verification Results

| Item | Status | Evidence |
|------|--------|----------|
| Workspace inspection | VERIFIED | tool inventory output captured |
| Next.js dev server | VERIFIED | `dev.log` shows "Ready in 678ms" |
| Required documents authored | VERIFIED | files exist under `docs/` and `context/` |

## 10. Bugs Discovered

None.

## 11. Bugs Fixed

None.

## 12. Remaining Issues

- The remaining 17 spirals must be implemented.
- Docker, Go, Rust, Ruby runtimes are unavailable; runners will report
  unavailability.

## 13. Acceptance Status

ACCEPTED for spiral 0. All required documents are present; the project
state files are initialised; the next spiral is unblocked.

## 14. Next Tasks

1. Spiral 1: Push Prisma schema + seed; build layout shell + sidebar + command palette.
2. Spiral 2: Project Registry API + UI.
3. Spiral 3: Project Discovery Engine.
4. Spiral 4: README Intelligence Engine.
5. Spiral 5: Safe Project Runner + WS mini-service.
6. Spiral 6: Process Management & Monitoring UI.
7. Spiral 7: Health checks + log viewer.
8. Spiral 8-11: Knowledge catalogue seed.
9. Spiral 9: OSV/NVD integration.
10. Spiral 12: Scanner plugin architecture.
11. Spiral 15: Compliance catalogue.
12. Spiral 16: Audit trail + secret redaction.
13. Spiral 17: Agent-browser self-verification.
