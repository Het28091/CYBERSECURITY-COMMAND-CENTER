// GET /api/scanners — list available scanners

import { NextRequest } from 'next/server';
import { ok } from '@/lib/cyber/api';
import { listScannerMeta } from '@/lib/cyber/scanners/scanners';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  return ok(listScannerMeta());
}
