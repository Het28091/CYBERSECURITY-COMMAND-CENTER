// GET /api/projects/[id]/logs — paginated log viewer

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { redact } from '@/lib/cyber/security/redact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), 5000);
  const stream = url.searchParams.get('stream'); // stdout|stderr|event|undefined

  const where: any = { projectId: id };
  if (stream) where.stream = stream;

  const logs = await db.projectLog.findMany({
    where, orderBy: { ts: 'desc' }, take: limit,
  });
  return ok(logs.reverse().map((l) => ({ ...l, line: redact(l.line), ts: l.ts.toISOString() })));
}
