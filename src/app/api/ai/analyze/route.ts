// POST /api/ai/analyze — AI-powered project security analysis
// Body: { projectId: string }

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { analyzeProjectSecurity } from '@/lib/cyber/ai/engine';
import { requireAuth } from '@/lib/cyber/auth';
import { getSettings } from '@/lib/cyber/settings';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({ projectId: z.string().min(1).max(200) });

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

  const result = await analyzeProjectSecurity(parsed.data.projectId);

  if (!result.ok) {
    await record({ action: 'ai.analyze', objectType: 'project', objectId: parsed.data.projectId, result: 'failure', reason: result.error });
    return err('AI_ERROR', result.error ?? 'Analysis failed', 500);
  }

  await record({ action: 'ai.analyze', objectType: 'project', objectId: parsed.data.projectId, result: 'success', metadata: { tokensUsed: result.tokensUsed } });
  return ok({ response: result.response, tokensUsed: result.tokensUsed });
}
