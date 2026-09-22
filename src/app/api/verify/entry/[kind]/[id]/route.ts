// POST /api/verify/entry/[kind]/[id] — verify a single knowledge entry's URL
// kind: tool | owasp | ai | framework

import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/cyber/api';
import { verifyEntry, type EntryKind } from '@/lib/cyber/verification/entries';
import { record } from '@/lib/cyber/audit/record';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const VALID_KINDS: EntryKind[] = ['tool', 'owasp', 'ai', 'framework'];

export async function POST(_req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const __auth = await requireAuth(_req, 'run');
  if (!__auth.ok) return __auth.response!;

  const { kind, id } = await ctx.params;
  if (!VALID_KINDS.includes(kind as EntryKind)) {
    return err('INVALID_INPUT', `kind must be one of ${VALID_KINDS.join(', ')}`, 400);
  }
  const result = await verifyEntry(kind as EntryKind, id);
  await record({
    action: 'verify.entry',
    objectType: kind,
    objectId: id,
    result: result.ok ? 'success' : 'failure',
    reason: result.reason,
  });
  return ok(result);
}
