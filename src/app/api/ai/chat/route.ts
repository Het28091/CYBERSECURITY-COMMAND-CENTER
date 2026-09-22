// POST /api/ai/chat — AI assistant chat endpoint
// Body: { messages: ChatMessage[], context?: AIContext }

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { aiChat, type ChatMessage, type AIContext } from '@/lib/cyber/ai/engine';
import { requireAuth } from '@/lib/cyber/auth';
import { getSettings } from '@/lib/cyber/settings';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(5000),
  })).min(1).max(20),
  context: z.object({
    projectName: z.string().optional(),
    projectPath: z.string().optional(),
    projectLanguage: z.string().optional(),
    projectFramework: z.string().optional(),
    projectStatus: z.string().optional(),
    projectHealth: z.string().optional(),
    findingsCount: z.number().optional(),
    cveQuery: z.string().optional(),
    viewContext: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, 'read');
  if (!auth.ok) return auth.response!;

  // Check if AI is enabled
  const settings = await getSettings();
  if (!settings.aiAssistanceEnabled) {
    return err('AI_DISABLED', 'AI assistance is disabled. Enable it in Settings.', 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return parsed.error;

  const result = await aiChat(
    parsed.data.messages as ChatMessage[],
    parsed.data.context as AIContext | undefined,
  );

  if (!result.ok) {
    await record({ action: 'ai.chat', objectType: 'ai', result: 'failure', reason: result.error });
    return err('AI_ERROR', result.error ?? 'AI request failed', 500);
  }

  await record({
    action: 'ai.chat', objectType: 'ai', result: 'success',
    metadata: {
      messages: parsed.data.messages.length,
      tokensUsed: result.tokensUsed,
      contextView: parsed.data.context?.viewContext,
    },
  });

  return ok({ response: result.response, tokensUsed: result.tokensUsed });
}
