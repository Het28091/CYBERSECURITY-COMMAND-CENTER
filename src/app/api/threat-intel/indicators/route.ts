// GET /api/threat-intel/indicators — list indicators with filters

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, jParse } from '@/lib/cyber/api';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  const url = new URL(req.url);
  const feedCode = url.searchParams.get('feed');
  const type = url.searchParams.get('type');
  const severity = url.searchParams.get('severity');
  const q = url.searchParams.get('q');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 200), 2000);

  const where: any = {};
  if (type) where.type = type;
  if (severity) where.severity = severity;
  if (q) where.value = { contains: q.toUpperCase() };
  if (feedCode) {
    const feed = await db.threatFeed.findUnique({ where: { code: feedCode } });
    if (feed) where.feedId = feed.id;
  }

  const indicators = await db.threatIndicator.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { publishedAt: 'desc' }],
    take: limit,
    include: { feed: { select: { code: true, name: true } } },
  });

  return ok(indicators.map((i: any) => ({
    ...i,
    references: jParse(i.references, []),
    publishedAt: i.publishedAt?.toISOString() ?? null,
    retrievedAt: i.retrievedAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
    feedCode: i.feed?.code,
    feedName: i.feed?.name,
  })));
}
