// POST /api/projects/[id]/restart — stop, then run again

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { proc } from '@/lib/cyber/runner/process';
import { record } from '@/lib/cyber/audit/record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  if (proc.isRunning(id)) {
    await proc.stop(id, 'restart requested');
    await new Promise((r) => setTimeout(r, 1500));
  }
  await record({ action: 'project.restart', objectType: 'project', objectId: id, result: 'success' });
  // Re-invoke the run handler.
  return POST_run(req, id);
}

async function POST_run(req: NextRequest, id: string) {
  // Forward to the run route logic
  const runModule = await import('../run/route');
  return runModule.POST(req, { params: Promise.resolve({ id }) } as any);
}
