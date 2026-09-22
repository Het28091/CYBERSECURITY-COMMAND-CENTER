// GET /api/compliance — list compliance frameworks with their controls
// PATCH /api/compliance/[fwId]/controls/[ctrlId] — update applicability / status / evidence

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err, parseBody, jParse } from '@/lib/cyber/api';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const __auth = await requireAuth(_req, 'read');
  if (!__auth.ok) return __auth.response!;

  const frameworks = await db.complianceFramework.findMany({
    orderBy: { code: 'asc' },
    include: { controls: { orderBy: { code: 'asc' } } },
  });
  return ok(frameworks.map((f: any) => ({
    ...f,
    lastVerifiedAt: f.lastVerifiedAt?.toISOString() ?? null,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    controls: f.controls.map((c: any) => ({
      ...c,
      evidence: c.evidence ? jParse(c.evidence, null) : null,
      lastReviewedAt: c.lastReviewedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  })));
}
