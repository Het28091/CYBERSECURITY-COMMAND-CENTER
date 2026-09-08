// GET /api/scanners — list available scanners

import { ok } from '@/lib/cyber/api';
import { listScannerMeta } from '@/lib/cyber/scanners/scanners';

export const runtime = 'nodejs';

export async function GET() {
  return ok(listScannerMeta());
}
