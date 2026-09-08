// Process manager.
// Spawns tracked child processes, captures stdout/stderr, applies timeouts,
// handles graceful + forced shutdown, and emits events for the WS service.

import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import http from 'node:http';
import { db } from '@/lib/db';
import { redact } from '@/lib/cyber/security/redact';
import { checkCommand } from '@/lib/cyber/security/command';
import { ResolvedCommand } from '@/lib/cyber/runner/runners';

export interface ProcEvent {
  type: 'log' | 'status' | 'health' | 'done' | 'error';
  projectId: string;
  executionId: string;
  stream?: 'stdout' | 'stderr' | 'event';
  line?: string;
  status?: string;
  pid?: number;
  exitCode?: number;
  reason?: string;
  ts: string;
}

class ProcessManager extends EventEmitter {
  private tracked: Map<string, { proc: ChildProcess; executionId: string; projectId: string; killed: boolean }> = new Map();

  /** Spawn a tracked process. Returns the execution ID. */
  async start(opts: {
    projectId: string;
    executionId: string;
    cmd: ResolvedCommand;
  }): Promise<{ pid: number; executionId: string }> {
    const { projectId, executionId, cmd } = opts;

    // Final safety check before spawn.
    const policyResult = checkCommand(cmd.executable, cmd.args, { allowShell: false });
    if (!policyResult.ok) {
      throw new Error(`Command blocked: ${policyResult.reason}`);
    }

    // Spawn with argv (never shell string).
    const proc = spawn(cmd.executable, cmd.args, {
      cwd: cmd.cwd,
      env: { ...process.env, ...cmd.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    if (!proc.pid) {
      throw new Error('Failed to spawn process');
    }

    this.tracked.set(proc.pid.toString(), { proc, executionId, projectId, killed: false });

    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = redact(chunk.toString('utf8'));
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        this.emitEvent({ type: 'log', projectId, executionId, stream: 'stdout', line, ts: new Date().toISOString() });
        this.persistLog(projectId, executionId, 'stdout', line);
      }
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = redact(chunk.toString('utf8'));
      for (const line of text.split(/\r?\n/)) {
        if (!line) continue;
        this.emitEvent({ type: 'log', projectId, executionId, stream: 'stderr', line, ts: new Date().toISOString() });
        this.persistLog(projectId, executionId, 'stderr', line);
      }
    });

    proc.on('exit', (code, signal) => {
      const tracked = this.tracked.get(proc.pid!.toString());
      this.tracked.delete(proc.pid!.toString());
      const status = tracked?.killed ? 'killed' : (code === 0 ? 'completed' : 'failed');
      this.emitEvent({
        type: 'done', projectId, executionId,
        pid: proc.pid,
        exitCode: code ?? -1,
        status,
        reason: signal ? `signal ${signal}` : undefined,
        ts: new Date().toISOString(),
      });
      // Update execution record asynchronously.
      db.projectExecution.update({
        where: { id: executionId },
        data: { endedAt: new Date(), exitCode: code ?? -1, status, reason: signal ? `signal ${signal}` : null },
      }).catch((e) => console.error('Failed to update execution row:', e));
    });

    proc.on('error', (err) => {
      this.emitEvent({ type: 'error', projectId, executionId, reason: err.message, ts: new Date().toISOString() });
    });

    // Apply timeout.
    if (cmd.timeoutMs > 0) {
      setTimeout(() => {
        if (this.tracked.has(proc.pid!.toString())) {
          this.stop(projectId, 'timeout');
        }
      }, cmd.timeoutMs);
    }

    return { pid: proc.pid, executionId };
  }

  /** Graceful stop: SIGTERM, then SIGKILL after a grace period. */
  async stop(projectId: string, reason?: string, graceMs = 3000): Promise<void> {
    for (const [pidStr, info] of this.tracked.entries()) {
      if (info.projectId !== projectId) continue;
      info.killed = true;
      try {
        info.proc.kill('SIGTERM');
      } catch { /* ignore */ }
      setTimeout(() => {
        if (!info.proc.killed) {
          try { info.proc.kill('SIGKILL'); } catch { /* ignore */ }
        }
      }, graceMs);
      this.emitEvent({
        type: 'status', projectId, executionId: info.executionId,
        status: 'STOPPING', reason: reason ?? 'user requested', ts: new Date().toISOString(),
      });
    }
  }

  /** Stop all tracked children for a project (used on shutdown). */
  async stopAll(projectId: string): Promise<void> {
    for (const [, info] of this.tracked.entries()) {
      if (info.projectId === projectId) {
        info.killed = true;
        try { info.proc.kill('SIGKILL'); } catch { /* ignore */ }
      }
    }
  }

  isRunning(projectId: string): boolean {
    for (const [, info] of this.tracked.entries()) {
      if (info.projectId === projectId && !info.proc.killed) return true;
    }
    return false;
  }

  listRunning(): { pid: number; projectId: string; executionId: string }[] {
    const out: { pid: number; projectId: string; executionId: string }[] = [];
    for (const [pidStr, info] of this.tracked.entries()) {
      out.push({ pid: Number(pidStr), projectId: info.projectId, executionId: info.executionId });
    }
    return out;
  }

  private emitEvent(ev: ProcEvent) {
    this.emit('event', ev);
    // Bridge to the WebSocket mini-service on port 3003 so browser clients
    // can receive real-time updates.
    try {
      const body = JSON.stringify(ev);
      const req = http.request({
        host: '127.0.0.1', port: 3003, path: '/emit', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 2000,
      });
      req.on('error', () => { /* silent — WS service may be down */ });
      req.write(body);
      req.end();
    } catch { /* ignore */ }
  }

  private async persistLog(projectId: string, executionId: string, stream: string, line: string) {
    try {
      await db.projectLog.create({
        data: { projectId, executionId, stream, line: redact(line) },
      });
    } catch (e) {
      console.error('Failed to persist log line:', e);
    }
  }
}

// Single shared instance across the Next.js server.
const globalForProc = globalThis as unknown as { __cyberProc?: ProcessManager };
export const proc = globalForProc.__cyberProc ?? new ProcessManager();
if (process.env.NODE_ENV !== 'production') globalForProc.__cyberProc = proc;
