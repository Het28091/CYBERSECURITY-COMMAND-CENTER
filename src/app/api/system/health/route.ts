// GET /api/system/health — probe DB, FS, WS

import { NextRequest } from 'next/server';
import { ok } from '@/lib/cyber/api';
import { db } from '@/lib/db';
import * as fs from 'node:fs';
import * as path from 'node:path';
import http from 'node:http';
import { requireAuth } from '@/lib/cyber/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const __auth = await requireAuth(req, 'read');
  if (!__auth.ok) return __auth.response!;

  let dbOk: 'ok' | 'fail' = 'ok';
  let fsOk: 'ok' | 'fail' = 'ok';
  let wsOk: 'ok' | 'fail' = 'ok';

  try {
    await db.project.count();
  } catch { dbOk = 'fail'; }

  try {
    const dir = path.resolve('/home/z/my-project');
    fs.accessSync(dir, fs.constants.R_OK);
  } catch { fsOk = 'fail'; }

  // Probe the WS service.
  wsOk = await new Promise<'ok' | 'fail'>((resolve) => {
    try {
      const probeReq = http.request({ host: '127.0.0.1', port: 3003, path: '/', method: 'GET', timeout: 1500 }, (res) => {
        res.destroy();
        resolve('ok');
      });
      probeReq.on('error', () => resolve('fail'));
      probeReq.on('timeout', () => { probeReq.destroy(); resolve('fail'); });
      probeReq.end();
    } catch { resolve('fail'); }
  });

  const overall = (dbOk === 'ok' && fsOk === 'ok' && wsOk === 'ok')
    ? 'HEALTHY'
    : (dbOk === 'ok' && fsOk === 'ok' ? 'DEGRADED' : 'UNAVAILABLE');

  return ok({ db: dbOk, fs: fsOk, ws: wsOk, overall });
}
