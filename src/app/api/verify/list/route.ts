// GET /api/verify — list recent verification requests
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, jParse } from '@/lib/cyber/api';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  const rows = await db.verificationRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok(rows.map((r: any) => ({
    ...r,
    evidence: jParse(r.evidence, []),
    sources: jParse(r.sources, []),
    primaryAt: r.primaryAt.toISOString(),
    secondaryAt: r.secondaryAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
}
