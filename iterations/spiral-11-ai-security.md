# Spiral 11 — AI & LLM Security Center

**Spiral:** 11  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Catalogue AI/LLM security concepts covering prompt injection, jailbreaks,
RAG security, agent security, model supply chain, and oversight.

## Requirements Addressed
FR-100, FR-101.

## Implementation
- Seed script populated 15 AI/LLM security entries:
  - prompt-injection (Direct, Indirect).
  - jailbreak.
  - data-leakage (Sensitive Information Disclosure).
  - output-handling (Insecure Output Handling).
  - tool-use (Insecure Tool Use).
  - agents (Excessive Agency).
  - rag (RAG Security).
  - supply-chain (Model Supply Chain).
  - data-poisoning (Data Poisoning).
  - model-theft (Model Theft).
  - adversarial-inputs (Adversarial Inputs).
  - dos (AI Denial of Service).
  - identity (Identity and Authorization for Agents).
  - oversight (Human Oversight).
- Each entry: category, name, summary, mitigations array, officialUrl
  (OWASP GenAI / EU AI Act), verificationStatus=VERIFIED.
- `GET /api/ai-security?category=` for filtering.
- `AiSecurityView` grid.

## Tests
- 15 entries seeded.
- Browser: grid renders with category badges and source links.

## Acceptance: ACCEPTED. Next: Spiral 12 (Scanner Plugin Architecture).
