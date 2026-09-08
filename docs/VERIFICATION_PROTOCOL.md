# VERIFICATION_PROTOCOL.md

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Verification States

`UNVERIFIED` → `VERIFYING` → `VERIFIED` | `REJECTED` | `CONFLICT` | `FAILED` | `STALE` | `UNKNOWN`

## 2. Workflow

1. Primary analysis produces a claim with evidence.
2. Identify the authoritative source for the claim.
3. Send to the verification layer (in this session: same agent, re-evaluating
   with stricter rules).
4. Compare primary vs verification verdict.
5. Resolve disagreement:
   - MINOR → keep VERIFIED with a note.
   - MATERIAL → gather additional evidence and retry.
   - CRITICAL → do not present as VERIFIED; record `CONFLICT`.
6. Record `VerificationRequest` and `VerificationResult`.

## 3. In This Session

- Every external source is tagged with `source`, `retrievalTime`, `freshness`.
- AI output is tagged `AI_INTERPRETATION` and never `VERIFIED`.
- OWASP entries are tagged `VERIFIED` only when the source URL is reachable
  and matches the documented version.

## 4. Records

Stored in the audit trail under action `verify.*`. A future implementation
will materialise a `VerificationRequest` table; for this session, audit
events suffice.
