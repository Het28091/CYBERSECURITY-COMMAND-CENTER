// GET /api/owasp — list OWASP entries (optionally filtered by list)

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, jParse } from '@/lib/cyber/api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const list = url.searchParams.get('list') ?? '';
  const where: any = {};
  if (list) where.list = list;

  const entries = await db.owaspEntry.findMany({ where, orderBy: [{ list: 'asc' }, { rank: 'asc' }], take: 500 });
  return ok(entries.map((e: any) => ({
    ...e,
    mitigations: jParse(e.mitigations, []),
    lastVerifiedAt: e.lastVerifiedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  })));
}
