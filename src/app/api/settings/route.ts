// GET /api/settings + PATCH /api/settings

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { getSettings, updateSettings } from '@/lib/cyber/settings';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'admin');
  if (!__auth.ok) return __auth.response!;

  const s = await getSettings();
  return ok({ ...s, updatedAt: s.updatedAt.toISOString() });
}

const patchSchema = z.object({
  allowedProjectRoots: z.array(z.string().max(1024)).max(50).optional(),
  typoCorrection: z.boolean().optional(),
  bindLocalhost: z.boolean().optional(),
  maxLogLinesPerProject: z.number().int().min(100).max(100000).optional(),
  commandTimeoutMs: z.number().int().min(1000).max(3600000).optional(),
  externalFetchEnabled: z.boolean().optional(),
  aiAssistanceEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const __auth = await requireAuth(req, 'admin');
  if (!__auth.ok) return __auth.response!;
  const body = await req.json().catch(() => null);
  const parsed = parseBody(patchSchema, body);
  if (!parsed.ok) return parsed.error;
  const updated = await updateSettings(parsed.data);
  await record({ action: 'settings.update', objectType: 'settings', objectId: '1', result: 'success', metadata: { fields: Object.keys(parsed.data) } });
  return ok({ ...updated, updatedAt: updated.updatedAt.toISOString() });
}
