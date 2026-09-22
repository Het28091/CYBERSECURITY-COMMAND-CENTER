// GET /api/search?q=... — global search across projects, tools, OWASP, AI security,
// compliance, and audit events.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, jParse } from '@/lib/cyber/api';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (!q) return ok({ projects: [], tools: [], owasp: [], aiSecurity: [], compliance: [], audit: [] });

  // Typo correction: split by whitespace and try to match a known vocabulary.
  // (Only for non-technical text; never applied to CVE IDs, paths, or package names.)
  const corrected = applyTypoCorrection(q);

  const [projects, tools, owasp, aiSecurity, frameworks, audit] = await Promise.all([
    db.project.findMany({ where: { name: { contains: corrected } }, take: 50 }),
    db.securityTool.findMany({ where: { name: { contains: corrected } }, take: 50 }),
    db.owaspEntry.findMany({ where: { name: { contains: corrected } }, take: 50 }),
    db.aiSecurityEntry.findMany({ where: { name: { contains: corrected } }, take: 50 }),
    db.complianceFramework.findMany({ include: { controls: { take: 200 } } }),
    db.auditEvent.findMany({ where: { action: { contains: corrected } }, orderBy: { ts: 'desc' }, take: 50 }),
  ]);

  // Filter compliance controls by query inside framework scope.
  const complianceControls: any[] = [];
  for (const f of frameworks) {
    for (const c of (f as any).controls) {
      if (c.title?.toLowerCase().includes(corrected) || c.code?.toLowerCase().includes(corrected) || c.description?.toLowerCase().includes(corrected)) {
        complianceControls.push({ frameworkCode: (f as any).code, code: c.code, title: c.title, applicability: c.applicability, status: c.status });
      }
    }
  }

  return ok({
    projects: projects.map((p: any) => ({ id: p.id, name: p.name, localPath: p.localPath, status: p.status })),
    tools: tools.map((t: any) => ({ id: t.id, name: t.name, category: t.category, purpose: t.purpose, officialUrl: t.officialUrl })),
    owasp: owasp.map((e: any) => ({ id: e.id, list: e.list, rank: e.rank, name: e.name, officialUrl: e.officialUrl })),
    aiSecurity: aiSecurity.map((e: any) => ({ id: e.id, category: e.category, name: e.name, officialUrl: e.officialUrl })),
    compliance: complianceControls,
    audit: audit.map((a: any) => ({ id: a.id, ts: a.ts.toISOString(), action: a.action, objectType: a.objectType, result: a.result, metadata: jParse(a.metadata, {}) })),
  });
}

// Tiny typo-correction pass. Targets only common typo variants of well-known
// nav words. Never alters CVE IDs, paths, or package names.
function applyTypoCorrection(q: string): string {
  const map: Record<string, string> = {
    'proejcts': 'projects',
    'scaner': 'scanner',
    'scaners': 'scanners',
    'owas': 'owasp',
    'complianc': 'compliance',
    'vulnrability': 'vulnerability',
    'vulnerabilty': 'vulnerability',
    'vulnerabilties': 'vulnerabilities',
    'agentic': 'agents',
    'lgo': 'log',
    'setting': 'settings',
  };
  const tokens = q.toLowerCase().split(/\s+/);
  return tokens.map((t) => map[t] ?? t).join(' ');
}
