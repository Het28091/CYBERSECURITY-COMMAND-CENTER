// POST /api/projects/[id]/readme — runs the README intelligence engine

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { analyzeReadme } from '@/lib/cyber/readme/engine';
import { record } from '@/lib/cyber/audit/record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id }, include: { discoveries: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  try {
    const lastDiscovery = project.discoveries[0];
    const discoverySnap = lastDiscovery ? JSON.parse(lastDiscovery.snapshot) : undefined;
    const result = await analyzeReadme(project.localPath, discoverySnap);
    const commandsJson = JSON.stringify(result.commands);

    await db.readmeInference.create({
      data: { projectId: id, path: result.readmePath ?? '', commands: commandsJson, rendered: result.rendered },
    });

    // If we discovered a high-confidence run command, populate runCommand.
    const runCmd = result.commands.find((c) => c.kind === 'dev' && c.verified) ?? result.commands.find((c) => c.kind === 'run' && c.verified);
    if (runCmd) {
      await db.project.update({ where: { id }, data: { runCommand: runCmd.command } });
    }

    await record({
      action: 'project.readme', objectType: 'project', objectId: id, result: 'success',
      metadata: { commandsFound: result.commands.length, conflicts: result.conflicts.length, readmePath: result.readmePath },
    });

    return ok(result);
  } catch (e) {
    const reason = (e as Error).message;
    await record({ action: 'project.readme', objectType: 'project', objectId: id, result: 'failure', reason });
    return err('INTERNAL', `README analysis failed: ${reason}`, 500);
  }
}
