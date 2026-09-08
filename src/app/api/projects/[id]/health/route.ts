// GET /api/projects/[id]/health — probes process, ports, HTTP

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err, jParse } from '@/lib/cyber/api';
import { proc } from '@/lib/cyber/runner/process';
import * as net from 'node:net';
import * as http from 'node:http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  const ports: number[] = jParse(project.ports, []);
  const portStatuses = [];
  for (const port of ports) {
    portStatuses.push({ port, status: await probePort(port) });
  }

  // HTTP health probe (if a health endpoint is configured).
  let httpStatus: { endpoint: string; ok: boolean; statusCode?: number; reason?: string } | null = null;
  if (project.healthEndpoint) {
    httpStatus = await probeHttp(project.healthEndpoint);
  } else if (ports.length > 0) {
    httpStatus = await probeHttp(`http://127.0.0.1:${ports[0]}/`);
  }

  const processAlive = proc.isRunning(id);

  // Determine overall health.
  let health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN' = 'UNKNOWN';
  if (processAlive) {
    if (ports.length > 0) {
      const anyOpen = portStatuses.some((p) => p.status === 'open');
      if (anyOpen) {
        if (httpStatus?.ok) health = 'HEALTHY';
        else if (httpStatus) health = 'DEGRADED';
        else health = 'HEALTHY';
      } else {
        health = 'DEGRADED';
      }
    } else {
      health = 'STARTED';
    }
  } else {
    health = 'UNKNOWN';
  }

  await db.project.update({
    where: { id },
    data: {
      health: health === 'STARTED' ? 'UNKNOWN' : (health as any),
      status: processAlive ? 'RUNNING' : 'STOPPED',
    },
  });

  return ok({ process: processAlive ? 'alive' : 'dead', ports: portStatuses, http: httpStatus, health });
}

async function probePort(port: number): Promise<'open' | 'closed' | 'filtered'> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(2000);
    sock.on('connect', () => { sock.destroy(); resolve('open'); });
    sock.on('error', () => resolve('closed'));
    sock.on('timeout', () => { sock.destroy(); resolve('filtered'); });
    sock.connect(port, '127.0.0.1');
  });
}

async function probeHttp(endpoint: string): Promise<{ endpoint: string; ok: boolean; statusCode?: number; reason?: string }> {
  return new Promise((resolve) => {
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return resolve({ endpoint, ok: false, reason: 'Unsupported protocol' });
      }
      const req = http.request(url, { method: 'GET', timeout: 3000 }, (res) => {
        res.destroy();
        resolve({ endpoint, ok: res.statusCode !== undefined && res.statusCode >= 100 && res.statusCode < 500, statusCode: res.statusCode });
      });
      req.on('error', (e) => resolve({ endpoint, ok: false, reason: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ endpoint, ok: false, reason: 'timeout' }); });
      req.end();
    } catch (e) {
      resolve({ endpoint, ok: false, reason: (e as Error).message });
    }
  });
}
