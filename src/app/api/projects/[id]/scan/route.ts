// POST /api/projects/[id]/scan — run scanners against the project

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { SCANNERS, getScanner } from '@/lib/cyber/scanners/scanners';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  scanners: z.array(z.string()).min(1).max(10),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', 400, parsed.error.flatten());

  const scanRunIds: string[] = [];
  const summaries: any[] = [];

  for (const scannerId of parsed.data.scanners) {
    const scanner = getScanner(scannerId);
    if (!scanner || !scanner.supported) {
      await record({ action: 'scan.start', objectType: 'project', objectId: id, result: 'failure', reason: `Unknown or unsupported scanner: ${scannerId}` });
      continue;
    }

    const scanRun = await db.scanRun.create({
      data: { projectId: id, scanner: scanner.id, status: 'running', startedAt: new Date() },
    });
    scanRunIds.push(scanRun.id);

    try {
      const result = await scanner.scan(project.localPath);
      // Persist findings.
      for (const f of result.findings) {
        await db.scanFinding.create({
          data: {
            scanRunId: scanRun.id, projectId: id, scanner: scanner.id,
            severity: f.severity, rule: f.rule, title: f.title,
            description: f.description, evidence: f.evidence, confidence: f.confidence,
          },
        });
      }
      await db.scanRun.update({
        where: { id: scanRun.id },
        data: { status: 'completed', endedAt: new Date(), summary: JSON.stringify(result.summary) },
      });
      summaries.push({ scanner: scanner.id, summary: result.summary, warnings: result.warnings });
      await record({ action: 'scan.complete', objectType: 'project', objectId: id, result: 'success', metadata: { scanner: scanner.id, findings: result.findings.length } });
    } catch (e) {
      const reason = (e as Error).message;
      await db.scanRun.update({ where: { id: scanRun.id }, data: { status: 'failed', endedAt: new Date(), summary: JSON.stringify({ error: reason }) } });
      summaries.push({ scanner: scanner.id, error: reason });
      await record({ action: 'scan.complete', objectType: 'project', objectId: id, result: 'failure', reason, metadata: { scanner: scanner.id } });
    }
  }

  return ok({ scanRunIds, summaries, scannerCatalogue: SCANNERS.map((s) => ({ id: s.id, name: s.name, supported: s.supported })) });
}
