// GET /api/system/health — probe DB, FS, WS

import { ok } from '@/lib/cyber/api';
import { db } from '@/lib/db';
import * as fs from 'node:fs';
import * as path from 'node:path';
import http from 'node:http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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
      const req = http.request({ host: '127.0.0.1', port: 3003, path: '/', method: 'GET', timeout: 1500 }, (res) => {
        res.destroy();
        resolve('ok');
      });
      req.on('error', () => resolve('fail'));
      req.on('timeout', () => { req.destroy(); resolve('fail'); });
      req.end();
    } catch { resolve('fail'); }
  });

  const overall = (dbOk === 'ok' && fsOk === 'ok' && wsOk === 'ok')
    ? 'HEALTHY'
    : (dbOk === 'ok' && fsOk === 'ok' ? 'DEGRADED' : 'UNAVAILABLE');

  return ok({ db: dbOk, fs: fsOk, ws: wsOk, overall });
}
