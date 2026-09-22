// GET /api/threat-intel/feeds — list feeds
// POST /api/threat-intel/feeds — seed/register a feed

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { FEED_ADAPTERS, computeFreshness } from '@/lib/cyber/threatintel/feeds';
import { record } from '@/lib/cyber/audit/record';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  // Ensure all adapter-defined feeds exist in DB (idempotent upsert).
  for (const adapter of FEED_ADAPTERS) {
    await db.threatFeed.upsert({
      where: { code: adapter.code },
      update: { name: adapter.name, description: adapter.description, endpoint: adapter.endpoint, format: adapter.format },
      create: {
        code: adapter.code, name: adapter.name, description: adapter.description,
        endpoint: adapter.endpoint, format: adapter.format, trustTier: 1, enabled: true,
      },
    });
  }
  const feeds = await db.threatFeed.findMany({ orderBy: { code: 'asc' } });
  return ok(feeds.map((f: any) => {
    const freshness = computeFreshness(f.lastSuccessAt);
    // Compute health state:
    //   AVAILABLE     — last refresh succeeded and data is fresh (< 24h)
    //   STALE         — last refresh succeeded but data is old (> 24h)
    //   UNAVAILABLE   — last refresh failed
    //   BLOCKED       — last failure reason indicates network blocking (403/401)
    //   NOT_CONFIGURED — feed has never been refreshed
    let healthState: 'AVAILABLE' | 'UNAVAILABLE' | 'BLOCKED' | 'NOT_CONFIGURED' | 'STALE';
    if (!f.lastSuccessAt && !f.lastFailureAt) {
      healthState = 'NOT_CONFIGURED';
    } else if (f.lastFailureAt && (!f.lastSuccessAt || f.lastFailureAt > f.lastSuccessAt)) {
      const reason = f.lastFailureReason ?? '';
      if (reason.includes('403') || reason.includes('401')) healthState = 'BLOCKED';
      else healthState = 'UNAVAILABLE';
    } else if (freshness === 'stale') {
      healthState = 'STALE';
    } else {
      healthState = 'AVAILABLE';
    }
    return {
      ...f,
      lastSuccessAt: f.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: f.lastFailureAt?.toISOString() ?? null,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      freshness,
      healthState,
    };
  }));
}

export async function POST(_req: NextRequest) {
  const __auth = await requireAuth(_req, 'admin');
  if (!__auth.ok) return __auth.response!;
  // Re-seed the catalogue from the adapter list (idempotent).
  for (const adapter of FEED_ADAPTERS) {
    await db.threatFeed.upsert({
      where: { code: adapter.code },
      update: {},
      create: {
        code: adapter.code, name: adapter.name, description: adapter.description,
        endpoint: adapter.endpoint, format: adapter.format, trustTier: 1, enabled: true,
      },
    });
  }
  await record({ action: 'threatintel.seed', objectType: 'threat_feed', result: 'success', metadata: { count: FEED_ADAPTERS.length } });
  return ok({ seeded: FEED_ADAPTERS.length });
}
