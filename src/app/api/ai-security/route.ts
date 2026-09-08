// GET /api/ai-security — list AI / LLM security entries (optionally filtered by category)

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, jParse } from '@/lib/cyber/api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category') ?? '';
  const where: any = {};
  if (category) where.category = category;

  const entries = await db.aiSecurityEntry.findMany({ where, orderBy: [{ category: 'asc' }, { name: 'asc' }], take: 500 });
  return ok(entries.map((e: any) => ({
    ...e,
    mitigations: jParse(e.mitigations, []),
    lastVerifiedAt: e.lastVerifiedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  })));
}
