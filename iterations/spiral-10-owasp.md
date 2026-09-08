# Spiral 10 — OWASP Knowledge System

**Spiral:** 10  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Catalogue OWASP Top 10 entries for Web (2021), API (2023), and LLM
(2025). Each entry links to the official OWASP source.

## Requirements Addressed
FR-090 to FR-092.

## Implementation
- Seed script populated 30 OWASP entries across 3 lists:
  - Web 2021: A01-A10 (Broken Access Control, Cryptographic Failures,
    Injection, Insecure Design, Security Misconfiguration, Vulnerable
    Components, Authentication Failures, Integrity Failures, Logging
    Failures, SSRF).
  - API 2023: API1-API10 (BOLA, Broken Auth, Property Level Authz,
    Resource Consumption, Function Level Authz, Sensitive Business
    Flows, SSRF, Misconfiguration, Inventory, Unsafe Consumption).
  - LLM 2025: LLM01-LLM10 (Prompt Injection, Sensitive Information
    Disclosure, Supply Chain, Data Poisoning, Output Handling, Excessive
    Agency, System Prompt Leakage, Vector Weaknesses, Misinformation,
    Unbounded Consumption).
- Each entry: rank, name, summary, mitigations array, officialUrl,
  verificationStatus=VERIFIED, lastVerifiedAt.
- `GET /api/owasp?list=` for filtering.
- `OwaspView` with tabbed list selector.

## Tests
- 30 entries seeded (verified by count script).
- Browser: tabs work; each entry shows VERIFIED pill and
  OFFICIAL_SOURCE label.

## Acceptance: ACCEPTED. Next: Spiral 11 (AI Security).
