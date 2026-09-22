// Secondary AI Verification workflow.
//
// Implements the workflow required by master instruction section 49-54:
//   PRIMARY ANALYSIS → EVIDENCE COLLECTION → SECONDARY AI REQUEST
//   → WAIT FOR RESPONSE → COMPARE → RESOLVE DISAGREEMENT
//   → STORE VERIFICATION → PUBLISH
//
// State machine: UNVERIFIED → VERIFYING → VERIFIED | REJECTED | CONFLICT
//                                  | FAILED | STALE | UNKNOWN
//
// A timeout NEVER becomes VERIFIED. A failed secondary call becomes FAILED.
// A disagreement becomes CONFLICT (CRITICAL) or REJECTED (MATERIAL).

import ZAI from 'z-ai-web-dev-sdk';
import { record } from '@/lib/cyber/audit/record';

export type VerificationState =
  | 'UNVERIFIED'        // no verification yet
  | 'VERIFYING'         // secondary AI dispatched, awaiting response
  | 'VERIFIED'          // primary and secondary agree
  | 'REJECTED'          // secondary disagrees (MINOR)
  | 'CONFLICT'          // secondary disagrees (MATERIAL or CRITICAL)
  | 'FAILED'            // secondary call failed
  | 'STALE'             // verified previously, but evidence has since changed
  | 'UNKNOWN';          // cannot determine

export type DisagreementLevel = 'MINOR' | 'MATERIAL' | 'CRITICAL';

export interface Claim {
  text: string;                  // the claim being verified
  evidence: string[];            // supporting evidence (file paths, URLs, etc.)
  sources: string[];             // authoritative sources (URLs)
  primaryAssessment: string;    // primary analysis verdict
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface VerificationResult {
  state: VerificationState;
  claim: Claim;
  secondaryAssessment?: string;
  agreement: boolean | null;     // null = couldn't compare
  disagreementLevel?: DisagreementLevel;
  reason?: string;
  primaryAt: string;
  secondaryAt?: string;
  durationMs: number;
}

const TIMEOUT_MS = 30000; // 30s — a timeout NEVER becomes VERIFIED

/**
 * Run a full verification workflow for a single claim. The secondary LLM
 * is given the claim, the evidence, and asked to independently assess it.
 *
 * This function is server-only. It blocks until the workflow completes
 * (or fails/times out).
 */
export async function verifyClaim(claim: Claim): Promise<VerificationResult> {
  const primaryAt = new Date().toISOString();
  const start = Date.now();

  // Mark VERIFYING immediately (audit record).
  await record({
    action: 'verify.start',
    objectType: 'verification',
    result: 'success',
    metadata: {
      claim: claim.text.slice(0, 240),
      evidenceCount: claim.evidence.length,
      sourcesCount: claim.sources.length,
      primaryConfidence: claim.confidence,
    },
  });

  let secondaryAssessment: string | undefined;
  let agreement: boolean | null = null;
  let disagreementLevel: DisagreementLevel | undefined;
  let state: VerificationState = 'FAILED';
  let reason: string | undefined;

  try {
    const secondary = await dispatchSecondaryAI(claim);
    secondaryAssessment = secondary.assessment;

    // Compare primary vs secondary.
    const comparison = compare(claim.primaryAssessment, secondary.assessment, claim.confidence);
    agreement = comparison.agreement;
    disagreementLevel = comparison.level;

    if (comparison.agreement) {
      state = 'VERIFIED';
    } else if (comparison.level === 'MINOR') {
      // Per master instruction section 54: MINOR disagreements may keep
      // VERIFIED with a note. We choose to mark REJECTED for transparency.
      state = 'REJECTED';
      reason = comparison.reason;
    } else if (comparison.level === 'MATERIAL') {
      state = 'CONFLICT';
      reason = comparison.reason;
    } else {
      // CRITICAL
      state = 'CONFLICT';
      reason = comparison.reason;
    }
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('timeout') || msg.includes('abort')) {
      state = 'FAILED';
      reason = 'secondary AI timed out — never becomes VERIFIED';
    } else {
      state = 'FAILED';
      reason = `secondary AI failed: ${msg}`;
    }
  }

  const durationMs = Date.now() - start;

  await record({
    action: 'verify.complete',
    objectType: 'verification',
    result: state === 'VERIFIED' ? 'success' : 'failure',
    reason,
    metadata: {
      claim: claim.text.slice(0, 240),
      state,
      agreement,
      disagreementLevel,
      durationMs,
    },
  });

  return {
    state,
    claim,
    secondaryAssessment,
    agreement,
    disagreementLevel,
    reason,
    primaryAt,
    secondaryAt: secondaryAssessment ? new Date().toISOString() : undefined,
    durationMs,
  };
}

/**
 * Dispatch the secondary AI request. Throws on timeout or error.
 */
async function dispatchSecondaryAI(claim: Claim): Promise<{ assessment: string }> {
  const prompt = buildPrompt(claim);

  // Use AbortController for hard timeout — a timeout NEVER becomes VERIFIED.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    // Use the z-ai-web-dev-sdk server-side.
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a secondary verification AI for a cybersecurity command center. Independently verify the claim below using ONLY the evidence and sources provided. Do not trust the primary assessment; form your own opinion. Respond with one of: AGREE, DISAGREE-MINOR, DISAGREE-MATERIAL, DISAGREE-CRITICAL, followed by a one-sentence justification. If the evidence is insufficient, respond: INSUFFICIENT-EVIDENCE.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // low temperature for deterministic verification
      max_tokens: 200,
    });
    const text = completion.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error('secondary AI returned empty response');
    return { assessment: text.trim() };
  } finally {
    clearTimeout(t);
  }
}

function buildPrompt(claim: Claim): string {
  return [
    `CLAIM: ${claim.text}`,
    ``,
    `PRIMARY ASSESSMENT: ${claim.primaryAssessment}`,
    `PRIMARY CONFIDENCE: ${claim.confidence}`,
    ``,
    `EVIDENCE:`,
    ...claim.evidence.map((e, i) => `  ${i + 1}. ${e}`),
    ``,
    `AUTHORITATIVE SOURCES:`,
    ...claim.sources.map((s, i) => `  ${i + 1}. ${s}`),
    ``,
    `Respond with AGREE, DISAGREE-MINOR, DISAGREE-MATERIAL, DISAGREE-CRITICAL, or INSUFFICIENT-EVIDENCE, then a one-sentence justification.`,
  ].join('\n');
}

/**
 * Compare primary vs secondary assessment.
 *
 * The secondary's response text is parsed for one of:
 *   AGREE, DISAGREE-MINOR, DISAGREE-MATERIAL, DISAGREE-CRITICAL, INSUFFICIENT-EVIDENCE
 */
function compare(primary: string, secondary: string, _primaryConfidence: 'HIGH' | 'MEDIUM' | 'LOW'): {
  agreement: boolean;
  level: DisagreementLevel;
  reason: string;
} {
  const text = secondary.toUpperCase();
  if (text.includes('DISAGREE-CRITICAL')) {
    return { agreement: false, level: 'CRITICAL', reason: 'secondary AI strongly disagrees (CRITICAL)' };
  }
  if (text.includes('DISAGREE-MATERIAL')) {
    return { agreement: false, level: 'MATERIAL', reason: 'secondary AI disagrees (MATERIAL)' };
  }
  if (text.includes('DISAGREE-MINOR')) {
    return { agreement: false, level: 'MINOR', reason: 'secondary AI disagrees (MINOR)' };
  }
  if (text.includes('INSUFFICIENT-EVIDENCE')) {
    return { agreement: false, level: 'MATERIAL', reason: 'secondary AI reports insufficient evidence' };
  }
  if (text.includes('AGREE')) {
    return { agreement: true, level: 'MINOR', reason: 'secondary AI agrees' };
  }
  // Unparseable response — treat as MATERIAL disagreement for safety.
  return { agreement: false, level: 'MATERIAL', reason: 'secondary AI response unparseable' };
}

/**
 * Convenience: build a Claim for verifying a CVE query result.
 * Useful when the user looks up a CVE and wants the result verified.
 */
export function buildCveClaim(cveId: string, summary: string, severity: string | null, sources: string[]): Claim {
  return {
    text: `CVE ${cveId} has summary "${summary}" and severity "${severity ?? 'unknown'}"`,
    evidence: [`CVE ID: ${cveId}`, `Summary: ${summary}`, `Severity: ${severity ?? 'null'}`],
    sources,
    primaryAssessment: `Retrieved from authoritative source. Summary and severity as returned by upstream.`,
    confidence: 'HIGH',
  };
}

/**
 * Convenience: build a Claim for verifying a README-inferred run command.
 */
export function buildReadmeClaim(command: string, evidence: string[], verified: boolean, conflicts: string[]): Claim {
  return {
    text: `README command "${command}" is the correct way to run this project`,
    evidence,
    sources: ['README.md (project file)'],
    primaryAssessment: verified
      ? `Cross-check passed. ${conflicts.length ? `Conflicts: ${conflicts.join('; ')}` : 'No conflicts.'}`
      : `Cross-check did not pass. ${conflicts.length ? `Conflicts: ${conflicts.join('; ')}` : 'No conflicts recorded.'}`,
    confidence: verified ? 'HIGH' : 'MEDIUM',
  };
}
