// GET /api/system/datasources — list external data sources with freshness

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok } from '@/lib/cyber/api';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  const sources = await db.dataSource.findMany({ orderBy: { code: 'asc' } });
  const now = Date.now();
  const STALE_AFTER = 24 * 60 * 60 * 1000; // 24h
  return ok(sources.map((s: any) => {
    let freshness: 'fresh' | 'stale' | 'unknown' = 'unknown';
    if (s.lastSuccessAt) {
      freshness = (now - s.lastSuccessAt.getTime()) < STALE_AFTER ? 'fresh' : 'stale';
    }
    return {
      ...s,
      lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: s.lastFailureAt?.toISOString() ?? null,
      cachedAt: s.cachedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      freshness,
    };
  }));
}
