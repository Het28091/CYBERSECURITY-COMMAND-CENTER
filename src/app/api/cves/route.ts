// GET /api/cves?q=... — query OSV.dev or NVD for vulnerabilities

import { NextRequest } from 'next/server';
import { ok } from '@/lib/cyber/api';
import { queryVulnerabilities } from '@/lib/cyber/external/vulnerabilities';
import { record } from '@/lib/cyber/audit/record';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const result = await queryVulnerabilities(q);
  await record({
    action: 'cve.query', objectType: 'vulnerability', result: result.error ? 'failure' : 'success',
    metadata: { query: q, source: result.source, count: result.items.length, error: result.error },
  });
  return ok(result);
}
