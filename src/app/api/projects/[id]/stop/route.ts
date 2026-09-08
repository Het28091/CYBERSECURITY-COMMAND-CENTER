// POST /api/projects/[id]/stop

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { proc } from '@/lib/cyber/runner/process';
import { record } from '@/lib/cyber/audit/record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  if (!proc.isRunning(id)) {
    await db.project.update({ where: { id }, data: { status: 'STOPPED' } });
    return ok({ ok: true, wasRunning: false });
  }

  await proc.stop(id, 'user requested stop');
  await db.project.update({ where: { id }, data: { status: 'STOPPING' } });
  await record({ action: 'project.stop', objectType: 'project', objectId: id, result: 'success' });
  // Status will transition to STOPPED via the proc manager's exit handler,
  // but to make the UI feel snappy we mark it stopped now too.
  setTimeout(() => {
    db.project.update({ where: { id }, data: { status: 'STOPPED' } }).catch(() => {});
  }, 500);
  return ok({ ok: true, wasRunning: true });
}
