// POST /api/ai/explain — AI-powered CVE explanation
// Body: { cveId: string, summary: string, severity: string|null }

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { explainVulnerability } from '@/lib/cyber/ai/engine';
import { requireAuth } from '@/lib/cyber/auth';
import { getSettings } from '@/lib/cyber/settings';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  cveId: z.string().min(1).max(200),
  summary: z.string().max(2000),
  severity: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'read');
  if (!auth.ok) return auth.response!;

  const settings = await getSettings();
  if (!settings.aiAssistanceEnabled) {
    return err('AI_DISABLED', 'AI assistance is disabled.', 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return parsed.error;

  const result = await explainVulnerability(parsed.data.cveId, parsed.data.summary, parsed.data.severity ?? null);

  if (!result.ok) {
    await record({ action: 'ai.explain', objectType: 'cve', result: 'failure', reason: result.error });
    return err('AI_ERROR', result.error ?? 'Explanation failed', 500);
  }

  await record({ action: 'ai.explain', objectType: 'cve', objectId: parsed.data.cveId, result: 'success', metadata: { tokensUsed: result.tokensUsed } });
  return ok({ response: result.response, tokensUsed: result.tokensUsed });
}
