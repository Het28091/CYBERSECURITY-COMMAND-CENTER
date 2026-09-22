// GET /api/projects/[id]/scans — list scan runs for a project

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err, jParse } from '@/lib/cyber/api';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const __auth = await requireAuth(_req, 'read');
  if (!__auth.ok) return __auth.response!;

  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  const scans = await db.scanRun.findMany({
    where: { projectId: id },
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: { _count: { select: { findings: true } } },
  });

  return ok(scans.map((s: any) => ({
    ...s,
    summary: jParse(s.summary, null),
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    findingCount: (s._count as any)?.findings ?? 0,
  })));
}
