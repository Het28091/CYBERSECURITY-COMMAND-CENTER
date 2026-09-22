// POST /api/verify — run a secondary AI verification on a claim.
// Body: { text, evidence?, sources?, primaryAssessment?, confidence?, refType?, refId? }
// Returns: VerificationResult

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { verifyClaim, type Claim } from '@/lib/cyber/verification/engine';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // allow long verification (LLM can take 30s+)

const schema = z.object({
  text: z.string().min(1).max(2000),
  evidence: z.array(z.string().max(2000)).max(50).optional().default([]),
  sources: z.array(z.string().url().max(2000)).max(50).optional().default([]),
  primaryAssessment: z.string().max(2000).optional().default('Primary analysis produced this claim.'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().default('MEDIUM'),
  refType: z.string().max(50).optional(),         // cve|readme|discovery|claim
  refId: z.string().max(200).optional(),
  projectId: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const __auth = await requireAuth(req, 'run');
  if (!__auth.ok) return __auth.response!;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return parsed.error;

  const claim: Claim = {
    text: parsed.data.text,
    evidence: parsed.data.evidence,
    sources: parsed.data.sources,
    primaryAssessment: parsed.data.primaryAssessment,
    confidence: parsed.data.confidence,
  };

  // Persist a VerificationRequest row in VERIFYING state first.
  const vr = await db.verificationRequest.create({
    data: {
      claimText: claim.text,
      evidence: JSON.stringify(claim.evidence),
      sources: JSON.stringify(claim.sources),
      primaryAssessment: claim.primaryAssessment,
      primaryConfidence: claim.confidence,
      state: 'VERIFYING',
      refType: parsed.data.refType ?? null,
      refId: parsed.data.refId ?? null,
      projectId: parsed.data.projectId ?? null,
    },
  });

  // Run the verification workflow (blocks until done or fails/times out).
  const result = await verifyClaim(claim);

  // Update the row with the final state.
  await db.verificationRequest.update({
    where: { id: vr.id },
    data: {
      state: result.state,
      secondaryAssessment: result.secondaryAssessment ?? null,
      agreement: result.agreement,
      disagreementLevel: result.disagreementLevel ?? null,
      reason: result.reason ?? null,
      secondaryAt: result.secondaryAt ? new Date(result.secondaryAt) : null,
      durationMs: result.durationMs,
    },
  });

  return ok({ id: vr.id, ...result });
}
