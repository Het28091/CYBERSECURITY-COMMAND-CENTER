// GET /api/tools — list and search cybersecurity tools

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, jParse } from '@/lib/cyber/api';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.toLowerCase() ?? '';
  const category = url.searchParams.get('category') ?? '';

  const where: any = {};
  if (q) where.name = { contains: q };
  if (category) where.category = category;

  const tools = await db.securityTool.findMany({ where, orderBy: { name: 'asc' }, take: 500 });

  return ok(tools.map((t: any) => ({
    ...t,
    platforms: jParse(t.platforms, []),
    tags: jParse(t.tags, []),
    lastVerifiedAt: t.lastVerifiedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
}
