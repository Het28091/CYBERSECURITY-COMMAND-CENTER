// GET /api/export/audit?format=csv|json|md
// GET /api/export/findings?format=csv|json|md&projectId=&severity=
// GET /api/export/projects?format=csv|json|md
//
// Exports never include secrets (redaction applied to text fields).
// Master instruction section 79 requires JSON/CSV/Markdown export.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { redact } from '@/lib/cyber/security/redact';
import { jParse } from '@/lib/cyber/api';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => escape(row[h])).join(','));
  return lines.join('\n');
}

function toMd(title: string, rows: Record<string, any>[]): string {
  if (rows.length === 0) return `# ${title}\n\nNo rows.\n`;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => v === null || v === undefined ? '' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = [
    `# ${title}`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) lines.push(`| ${headers.map((h) => esc(row[h])).join(' | ')} |`);
  return lines.join('\n') + '\n';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  const { kind } = await ctx.params;
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase() as 'csv' | 'json' | 'md';

  let rows: Record<string, any>[] = [];
  let title = '';

  if (kind === 'audit') {
    title = 'Audit Events';
    const events = await db.auditEvent.findMany({ orderBy: { ts: 'desc' }, take: 5000 });
    rows = events.map((e: any) => ({
      ts: e.ts.toISOString(),
      actor: e.actor,
      action: e.action,
      objectType: e.objectType,
      objectId: e.objectId,
      result: e.result,
      reason: redact(e.reason ?? ''),
      metadata: redact(JSON.stringify(jParse(e.metadata, {}))),
    }));
  } else if (kind === 'findings') {
    title = 'Scan Findings';
    const projectId = url.searchParams.get('projectId');
    const severity = url.searchParams.get('severity');
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (severity) where.severity = severity;
    const findings = await db.scanFinding.findMany({ where, orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }], take: 5000 });
    rows = findings.map((f: any) => ({
      id: f.id,
      projectId: f.projectId,
      scanner: f.scanner,
      severity: f.severity,
      rule: f.rule,
      title: redact(f.title),
      description: redact(f.description),
      evidence: redact(f.evidence),
      confidence: f.confidence,
      createdAt: f.createdAt.toISOString(),
    }));
  } else if (kind === 'projects') {
    title = 'Projects';
    const projects = await db.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 5000 });
    rows = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: redact(p.description ?? ''),
      category: p.category,
      localPath: p.localPath,
      language: p.language,
      framework: p.framework,
      packageManager: p.packageManager,
      entryPoint: p.entryPoint,
      runCommand: redact(p.runCommand ?? ''),
      ports: p.ports,
      status: p.status,
      health: p.health,
      verificationStatus: p.verificationStatus,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  } else {
    return new Response(JSON.stringify({ ok: false, error: 'unknown kind' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  if (format === 'json') {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${kind}.json"` },
    });
  }
  if (format === 'csv') {
    return new Response(toCsv(rows), {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${kind}.csv"` },
    });
  }
  // md
  return new Response(toMd(title, rows), {
    headers: { 'Content-Type': 'text/markdown', 'Content-Disposition': `attachment; filename="${kind}.md"` },
  });
}
