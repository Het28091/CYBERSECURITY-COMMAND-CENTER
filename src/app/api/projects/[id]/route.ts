// GET /api/projects/[id]
// PATCH /api/projects/[id]
// DELETE /api/projects/[id]

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err, parseBody, jParse } from '@/lib/cyber/api';
import { record } from '@/lib/cyber/audit/record';
import { redact } from '@/lib/cyber/security/redact';
import { z } from 'zod';
import type { ProjectRow } from '@/lib/cyber/types';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';

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

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(10000).optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const __auth = await requireAuth(_req, 'read');
  if (!__auth.ok) return __auth.response!;

  const { id } = await ctx.params;
  const p = await db.project.findUnique({ where: { id }, include: { _count: { select: { findings: true } } } });
  if (!p) return err('NOT_FOUND', 'Project not found', 404);
  return ok({ ...row(p), findingCount: (p._count as any)?.findings ?? 0 });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const __auth = await requireAuth(req, 'update');
  if (!__auth.ok) return __auth.response!;
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) return err('NOT_FOUND', 'Project not found', 404);
  const body = await req.json().catch(() => null);
  const parsed = parseBody(patchSchema, body);
  if (!parsed.ok) return parsed.error;
  const data: any = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.category !== undefined) data.category = parsed.data.category;
  if (parsed.data.tags !== undefined) data.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.notes !== undefined) data.notes = redact(parsed.data.notes);
  const updated = await db.project.update({ where: { id }, data });
  await record({ action: 'project.update', objectType: 'project', objectId: id, result: 'success', metadata: { fields: Object.keys(data) } });
  return ok(row(updated));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const __auth = await requireAuth(req, 'delete');
  if (!__auth.ok) return __auth.response!;
  const body = await req.json().catch(() => null);
  if (!body || body.confirm !== true) return err('INVALID_INPUT', 'Confirmation required: pass { confirm: true }', 400);
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) return err('NOT_FOUND', 'Project not found', 404);
  await db.project.delete({ where: { id } });
  await record({ action: 'project.delete', objectType: 'project', objectId: id, result: 'success', metadata: { name: existing.name, localPath: existing.localPath } });
  return ok({ ok: true });
}
