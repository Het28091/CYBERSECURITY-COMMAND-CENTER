// PATCH /api/compliance/[frameworkId]/controls/[controlId]

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  applicability: z.enum(['APPLICABLE', 'POSSIBLY_APPLICABLE', 'NOT_APPLICABLE', 'REVIEW_REQUIRED', 'UNKNOWN']).optional(),
  status: z.enum(['gap', 'partial', 'met', 'unknown']).optional(),
  evidence: z.string().max(20000).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ frameworkId: string; controlId: string }> }) {
  const { frameworkId, controlId } = await ctx.params;
  const fw = await db.complianceFramework.findUnique({ where: { id: frameworkId } });
  if (!fw) return err('NOT_FOUND', 'Framework not found', 404);
  const ctrl = await db.complianceControl.findFirst({ where: { frameworkId, id: controlId } });
  if (!ctrl) return err('NOT_FOUND', 'Control not found', 404);

  const body = await req.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return parsed.error;

  const data: any = { lastReviewedAt: new Date() };
  if (parsed.data.applicability !== undefined) data.applicability = parsed.data.applicability;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.evidence !== undefined) data.evidence = JSON.stringify({ text: parsed.data.evidence });

  const updated = await db.complianceControl.update({ where: { id: ctrl.id }, data });
  await record({
    action: 'compliance.update', objectType: 'compliance_control', objectId: ctrl.id, result: 'success',
    metadata: { framework: fw.code, control: ctrl.code, fields: Object.keys(data) },
  });
  return ok({
    ...updated,
    evidence: updated.evidence ? JSON.parse(updated.evidence) : null,
    lastReviewedAt: updated.lastReviewedAt?.toISOString() ?? null,
  });
}
