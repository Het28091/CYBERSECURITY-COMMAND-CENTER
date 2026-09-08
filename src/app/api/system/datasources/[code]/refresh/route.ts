// POST /api/system/datasources/[code]/refresh — trigger a freshness recheck

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { record } from '@/lib/cyber/audit/record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const source = await db.dataSource.findUnique({ where: { code } });
  if (!source) return err('NOT_FOUND', 'Data source not found', 404);

  // Try a lightweight HEAD request to the endpoint to confirm reachability.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(source.endpoint, { method: source.code === 'osv' ? 'POST' : 'HEAD', signal: ctrl.signal, headers: source.code === 'osv' ? { 'Content-Type': 'application/json' } : undefined, body: source.code === 'osv' ? JSON.stringify({ package: { ecosystem: 'npm', name: 'lodash' } }) : undefined });
    clearTimeout(t);
    if (!res.ok && res.status !== 405) {
      await db.dataSource.update({ where: { code }, data: { lastFailureAt: new Date(), lastFailureReason: `HTTP ${res.status}`, freshness: 'stale' } });
      await record({ action: 'datasource.refresh', objectType: 'datasource', objectId: code, result: 'failure', reason: `HTTP ${res.status}` });
      return ok({ code, ok: false, reason: `HTTP ${res.status}` });
    }
    await db.dataSource.update({ where: { code }, data: { lastSuccessAt: new Date(), lastFailureReason: null, freshness: 'fresh', cachedAt: new Date() } });
    await record({ action: 'datasource.refresh', objectType: 'datasource', objectId: code, result: 'success' });
    return ok({ code, ok: true });
  } catch (e) {
    const reason = (e as Error).message;
    await db.dataSource.update({ where: { code }, data: { lastFailureAt: new Date(), lastFailureReason: reason, freshness: 'stale' } });
    await record({ action: 'datasource.refresh', objectType: 'datasource', objectId: code, result: 'failure', reason });
    return ok({ code, ok: false, reason });
  }
}
