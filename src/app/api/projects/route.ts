// GET /api/projects — list projects (optionally filtered)
// POST /api/projects — register a new project (with path verification)

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err, parseBody, jParse } from '@/lib/cyber/api';
import { checkPath } from '@/lib/cyber/security/path';
import { getSettings } from '@/lib/cyber/settings';
import { record } from '@/lib/cyber/audit/record';
import { requireAuth } from '@/lib/cyber/auth';
import { z } from 'zod';
import type { ProjectRow } from '@/lib/cyber/types';
import { redact } from '@/lib/cyber/security/redact';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  localPath: z.string().min(1).max(2048),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

function row(row: any): ProjectRow {
  return {
    id: row.id, name: row.name, description: row.description,
    category: row.category, tags: jParse(row.tags, []),
    localPath: row.localPath, language: row.language, framework: row.framework,
    packageManager: row.packageManager, techStack: jParse(row.techStack, []),
    readmePath: row.readmePath, entryPoint: row.entryPoint, runCommand: row.runCommand,
    ports: jParse(row.ports, []), status: row.status, health: row.health,
    verificationStatus: row.verificationStatus,
    lastVerificationAt: row.lastVerificationAt?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastSuccessfulRunAt: row.lastSuccessfulRunAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    lastFailureReason: redact(row.lastFailureReason ?? null),
    findingCount: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, 'read');
  if (!auth.ok) return auth.response!;
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.toLowerCase() ?? '';
  const status = url.searchParams.get('status') ?? '';
  const category = url.searchParams.get('category') ?? '';

  const where: any = {};
  if (q) where.name = { contains: q };
  if (status) where.status = status;
  if (category) where.category = category;

  const projects = await db.project.findMany({
    where, orderBy: { updatedAt: 'desc' }, take: 500,
    include: { _count: { select: { findings: true } } },
  });

  const rows: ProjectRow[] = projects.map((p: any) => ({
    ...row(p),
    findingCount: (p._count as any)?.findings ?? 0,
  }));

  return ok(rows);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'create');
  if (!auth.ok) return auth.response!;
  const body = await req.json().catch(() => null);
  const parsed = parseBody(createSchema, body);
  if (!parsed.ok) return parsed.error;

  const settings = await getSettings();
  const pathCheck = checkPath(parsed.data.localPath, { roots: settings.allowedProjectRoots });
  if (!pathCheck.ok) {
    await record({
      action: 'project.add', objectType: 'project', result: 'failure',
      reason: pathCheck.reason ?? 'Path verification failed',
      metadata: { name: parsed.data.name, localPath: redact(parsed.data.localPath) },
    });
    if (pathCheck.canonical === null) {
      return err('PATH_INVALID', pathCheck.reason ?? 'Invalid path', 400);
    }
    if (!pathCheck.insideAllowedRoot) {
      return err('PATH_OUTSIDE_ROOT', pathCheck.reason ?? 'Path is outside allowed roots', 403);
    }
    return err('PATH_INVALID', pathCheck.reason ?? 'Path verification failed', 400);
  }

  // Reject duplicate registrations (same canonical path).
  const existing = await db.project.findFirst({ where: { localPath: pathCheck.real ?? parsed.data.localPath } });
  if (existing) {
    return err('PATH_INVALID', `Project already registered: ${existing.name}`, 409);
  }

  const created = await db.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      tags: JSON.stringify(parsed.data.tags ?? []),
      localPath: pathCheck.real ?? parsed.data.localPath,
      status: 'REGISTERED',
      health: 'UNKNOWN',
      verificationStatus: 'VERIFIED',
      lastVerificationAt: new Date(),
    },
  });

  await record({
    action: 'project.add', objectType: 'project', objectId: created.id, result: 'success',
    metadata: { name: created.name, localPath: created.localPath, canonical: pathCheck.canonical, symlink: pathCheck.symlink },
  });

  return ok(row(created), { status: 201 });
}
