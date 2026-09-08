// GET /api/projects/[id]/findings — list findings for a project (optional filters)

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  const url = new URL(req.url);
  const severity = url.searchParams.get('severity');
  const scanner = url.searchParams.get('scanner');

  const where: any = { projectId: id };
  if (severity) where.severity = severity;
  if (scanner) where.scanner = scanner;

  const findings = await db.scanFinding.findMany({
    where, orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }], take: 2000,
  });

  return ok(findings.map((f: any) => ({ ...f, createdAt: f.createdAt.toISOString() })));
}
