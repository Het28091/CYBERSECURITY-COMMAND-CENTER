// POST /api/projects/[id]/discover — runs the discovery engine

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { discover } from '@/lib/cyber/discovery/engine';
import { record } from '@/lib/cyber/audit/record';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  try {
    const snapshot = await discover(project.localPath);
    const json = JSON.stringify(snapshot);

    // Persist the snapshot.
    await db.projectDiscovery.create({
      data: { projectId: id, snapshot: json },
    });

    // Update the project row with discovered fields.
    const patch: any = {};
    if (snapshot.language && snapshot.language !== 'UNKNOWN') patch.language = snapshot.language;
    if (snapshot.framework && snapshot.framework !== 'UNKNOWN') patch.framework = snapshot.framework;
    if (snapshot.packageManager && snapshot.packageManager !== 'UNKNOWN') patch.packageManager = snapshot.packageManager;
    if (snapshot.techStack.length) patch.techStack = JSON.stringify(snapshot.techStack);
    if (snapshot.readmePath) patch.readmePath = snapshot.readmePath;
    if (snapshot.entryPoint && snapshot.entryPoint !== 'UNKNOWN') patch.entryPoint = snapshot.entryPoint;
    if (snapshot.ports.length) patch.ports = JSON.stringify(snapshot.ports);
    // envVars stored as a JSON object keyed by name → required
    if (snapshot.envVars.length) {
      const envMap: Record<string, { required: boolean; defaultValue: string | null }> = {};
      for (const e of snapshot.envVars) envMap[e.name] = { required: e.required, defaultValue: e.defaultValue };
      patch.envVars = JSON.stringify(envMap);
    }
    patch.status = 'DISCOVERED';

    const updated = await db.project.update({ where: { id }, data: patch });

    await record({
      action: 'project.discover', objectType: 'project', objectId: id, result: 'success',
      metadata: { language: snapshot.language, framework: snapshot.framework, packageManager: snapshot.packageManager, manifestFiles: snapshot.manifestFiles },
    });

    return ok({ snapshot, project: updated });
  } catch (e) {
    const reason = (e as Error).message;
    await record({ action: 'project.discover', objectType: 'project', objectId: id, result: 'failure', reason });
    return err('INTERNAL', `Discovery failed: ${reason}`, 500);
  }
}
