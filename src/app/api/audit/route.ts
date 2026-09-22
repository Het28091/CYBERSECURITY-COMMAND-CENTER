// GET /api/audit — list audit events (with filters)

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
  const action = url.searchParams.get('action') ?? '';
  const objectType = url.searchParams.get('objectType') ?? '';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 5000);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const where: any = {};
  if (action) where.action = { contains: action };
  if (objectType) where.objectType = objectType;
  if (from || to) {
    where.ts = {};
    if (from) where.ts.gte = new Date(from);
    if (to) where.ts.lte = new Date(to);
  }

  const events = await db.auditEvent.findMany({ where, orderBy: { ts: 'desc' }, take: limit });

  return ok(events.map((e: any) => ({
    ...e,
    ts: e.ts.toISOString(),
    metadata: jParse(e.metadata, {}),
  })));
}
