// POST /api/threat-intel/feeds/[id]/refresh — refresh one feed

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { refreshFeed } from '@/lib/cyber/threatintel/feeds';
import { record } from '@/lib/cyber/audit/record';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const __auth = await requireAuth(_req, 'admin');
  if (!__auth.ok) return __auth.response!;

  const { id } = await ctx.params;
  const feed = await db.threatFeed.findUnique({ where: { id } });
  if (!feed) return err('NOT_FOUND', 'Feed not found', 404);

  const result = await refreshFeed(feed.code);
  await record({
    action: 'threatintel.refresh',
    objectType: 'threat_feed',
    objectId: feed.id,
    result: result.ok ? 'success' : 'failure',
    reason: result.reason,
    metadata: { code: feed.code, indicatorCount: result.indicatorCount, freshness: result.freshness },
  });
  if (!result.ok) return ok({ ok: false, reason: result.reason, freshness: result.freshness });
  return ok({ ok: true, indicatorCount: result.indicatorCount, freshness: result.freshness });
}
