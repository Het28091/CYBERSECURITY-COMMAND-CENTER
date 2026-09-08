// POST /api/projects/[id]/verify — verifies the project location

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { checkPath } from '@/lib/cyber/security/path';
import { getSettings } from '@/lib/cyber/settings';
import { record } from '@/lib/cyber/audit/record';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  const settings = await getSettings();
  const pathCheck = checkPath(project.localPath, { roots: settings.allowedProjectRoots });
  if (!pathCheck.ok) {
    await db.project.update({
      where: { id },
      data: { verificationStatus: 'VERIFICATION_FAILED', lastVerificationAt: new Date() },
    });
    await record({ action: 'project.verify', objectType: 'project', objectId: id, result: 'failure', reason: pathCheck.reason ?? 'Path verification failed' });
    return ok({ ok: false, reason: pathCheck.reason ?? 'Path verification failed', details: pathCheck });
  }

  // If the real path differs from the stored path (e.g. symlink changed), update.
  if (pathCheck.real && pathCheck.real !== project.localPath) {
    await db.project.update({ where: { id }, data: { localPath: pathCheck.real, verificationStatus: 'VERIFIED', lastVerificationAt: new Date() } });
  } else {
    await db.project.update({ where: { id }, data: { verificationStatus: 'VERIFIED', lastVerificationAt: new Date() } });
  }

  await record({
    action: 'project.verify', objectType: 'project', objectId: id, result: 'success',
    metadata: { canonical: pathCheck.canonical, real: pathCheck.real, symlink: pathCheck.symlink },
  });

  return ok({ ok: true, details: pathCheck });
}
