# COMPLIANCE_MATRIX.md

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

This matrix lists the European compliance frameworks the Command Center
catalogues. **Inclusion here is not a claim of applicability to any user.**
The UI shows the disclaimer on every compliance page:

> This system provides technical compliance-readiness support, control
> mapping, evidence management, and gap analysis. It does not constitute
> legal advice, certification, or a guarantee of regulatory compliance.

## Frameworks

| Code | Kind | Official URL | Applicability default |
|------|------|---------------|------------------------|
| GDPR | Regulation | https://gdpr.eu/ | POSSIBLY_APPLICABLE |
| NIS2 | Directive | https://digital-strategy.ec.europa.eu/en/policies/nis2-directive | POSSIBLY_APPLICABLE |
| CRA | Regulation | https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act | POSSIBLY_APPLICABLE |
| DORA | Regulation | https://digital-finance-2025.europa.eu/ | POSSIBLY_APPLICABLE |
| EU-AI-ACT | Regulation | https://artificialintelligenceact.eu/ | POSSIBLY_APPLICABLE |

## Controls (seed catalogue, top entries per framework)

### GDPR
- GDPR-5-1 — Principles relating to processing of personal data
- GDPR-6 — Lawfulness of processing
- GDPR-7 — Consent
- GDPR-13 — Information to be provided
- GDPR-25 — Data protection by design and by default
- GDPR-30 — Records of processing activities
- GDPR-32 — Security of processing
- GDPR-33 — Notification of a personal data breach
- GDPR-35 — Data protection impact assessment
- GDPR-44 — Transfers to third countries

### NIS2
- NIS2-21-1 — Risk-management measures
- NIS2-21-2 — Reporting obligations
- NIS2-21-3 — Supervision and enforcement
- NIS2-23 — Reporting obligations for incidents
- NIS2-28 — Coordinated security risk assessments

### CRA
- CRA-13 — Cybersecurity requirements for products with digital elements
- CRA-14 — Vulnerability and incident reporting
- CRA-20 — Free and open-source software exceptions
- CRA-Annex-I — Security requirements

### DORA
- DORA-5 — ICT risk management
- DORA-6 — ICT-related incident reporting
- DORA-7 — Digital operational resilience testing
- DORA-8 — Information sharing arrangements
- DORA-9 — Third-party risk management

### EU-AI-ACT
- AI-6 — Classification of AI systems as prohibited / high-risk / limited / minimal
- AI-9 — High-risk AI systems list
- AI-10 — Transparency obligations
- AI-13 — Fundamental rights impact assessment
- AI-14 — Logging requirements
- AI-15 — Quality management system
- AI-27 — GPAI model obligations

## Per-control Status

| Status | Meaning |
|--------|---------|
| `gap` | No evidence; control not addressed. |
| `partial` | Some evidence exists; gaps remain. |
| `met` | Evidence and tests in place. |
| `unknown` | Applicability not yet reviewed. |

## Distinctions (displayed in UI)

The UI must clearly distinguish: **LAW** / **REGULATION** / **DIRECTIVE** /
**DELEGATED ACT** / **IMPLEMENTING ACT** / **STANDARD** / **CERTIFICATION** /
**GUIDANCE** / **BEST PRACTICE**.

Per-framework `kind` field is set in the seed data and shown as a pill.
