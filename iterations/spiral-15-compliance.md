# Spiral 15 — Compliance-Readiness System

**Spiral:** 15  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Catalogue European regulatory frameworks (GDPR, NIS2, CRA, DORA, EU AI
Act) with control-level applicability, status, and evidence. No legal
compliance claims.

## Requirements Addressed
FR-120 to FR-124.

## Implementation
- Seed script populated 5 frameworks and 31 controls:
  - GDPR (10 controls: principles, lawful basis, consent, info,
    privacy by design, RoPA, security of processing, breach
    notification, DPIA, third-country transfers).
  - NIS2 (5 controls: risk-management measures, reporting,
    supervision, incident handling, coordinated risk assessments).
  - CRA (4 controls: cybersecurity requirements, vulnerability
    reporting, FOSS exceptions, Annex I).
  - DORA (5 controls: ICT risk management, incident reporting,
    resilience testing, information sharing, third-party risk).
  - EU AI Act (7 controls: classification, high-risk list,
    transparency, FRIA, logging, QMS, GPAI obligations).
- Each control has applicability (APPLICABLE / POSSIBLY_APPLICABLE /
  NOT_APPLICABLE / REVIEW_REQUIRED / UNKNOWN) and status (gap /
  partial / met / unknown) — both editable.
- `GET /api/compliance` returns the framework tree.
- `PATCH /api/compliance/[fwId]/controls/[ctrlId]` updates
  applicability/status/evidence with audit trail.
- `ComplianceView` displays:
  - The compliance disclaimer prominently at the top.
  - Framework kind (law/regulation/directive/standard) and official
    URL.
  - Per-control applicability + status selects.
- Never claims "COMPLIANT".

## Tests
- 5 frameworks, 31 controls seeded (verified by count script).
- Browser: disclaimer visible, tabs switch between frameworks,
  controls render with description and editable selects.

## Acceptance: ACCEPTED. Next: Spiral 16 (Security Hardening).
