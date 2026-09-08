// POST /api/projects/[id]/run — validate + (optionally) dry-run + spawn
// Body: { dryRun?: boolean, action?: 'run' | 'dev' | 'build' | 'test', force?: boolean }

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/cyber/api';
import { discover } from '@/lib/cyber/discovery/engine';
import { analyzeReadme } from '@/lib/cyber/readme/engine';
import { pickRunner } from '@/lib/cyber/runner/runners';
import { checkCommand } from '@/lib/cyber/security/command';
import { proc } from '@/lib/cyber/runner/process';
import { record } from '@/lib/cyber/audit/record';
import { getSettings } from '@/lib/cyber/settings';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  dryRun: z.boolean().optional().default(false),
  action: z.enum(['run', 'dev', 'build', 'test']).optional().default('dev'),
  force: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return err('NOT_FOUND', 'Project not found', 404);

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', 400, parsed.error.flatten());
  const opts = parsed.data;

  // Refuse if already running.
  if (proc.isRunning(id) && !opts.force) {
    return err('PORT_IN_USE', 'Project is already running', 409);
  }

  const settings = await getSettings();
  const timeoutMs = settings.commandTimeoutMs;

  try {
    const discovery = await discover(project.localPath);
    const readme = await analyzeReadme(project.localPath, discovery);
    const runner = pickRunner(project.localPath, discovery);
    if (!runner) {
      await record({ action: 'project.run', objectType: 'project', objectId: id, result: 'failure', reason: 'No runner applies to this project' });
      return err('COMMAND_BLOCKED', 'No runner applies to this project', 422);
    }
    if (!runner.supported) {
      await record({ action: 'project.run', objectType: 'project', objectId: id, result: 'failure', reason: runner.unsupportedReason ?? 'Runner unsupported in this environment' });
      return err('COMMAND_BLOCKED', runner.unsupportedReason ?? 'Runner unsupported in this environment', 422);
    }

    const cmd = runner.buildCommand(opts.action, project.localPath, discovery, readme.commands);
    if (!cmd) {
      await record({ action: 'project.run', objectType: 'project', objectId: id, result: 'failure', reason: 'Runner produced no command for this action' });
      return err('COMMAND_BLOCKED', `Runner "${runner.id}" could not build a "${opts.action}" command`, 422);
    }

    cmd.timeoutMs = opts.action === 'build' ? timeoutMs * 3 : timeoutMs;

    // Security: command policy.
    const policy = checkCommand(cmd.executable, cmd.args, { allowShell: false });
    if (!policy.ok) {
      await record({ action: 'project.run', objectType: 'project', objectId: id, result: 'failure', reason: policy.reason ?? 'Command blocked by policy' });
      return err('COMMAND_BLOCKED', policy.reason ?? 'Command blocked by policy', 422);
    }

    // Dry-run: return the resolved command without spawning.
    if (opts.dryRun) {
      await db.projectExecution.create({
        data: { projectId: id, action: 'dryRun', command: cmd.display, status: 'completed', startedAt: new Date(), endedAt: new Date() },
      });
      await record({
        action: 'project.run', objectType: 'project', objectId: id, result: 'success',
        metadata: { dryRun: true, executable: cmd.executable, args: cmd.args, source: cmd.source, confidence: cmd.confidence, evidence: cmd.evidence },
      });
      return ok({ dryRun: true, command: cmd, runner: { id: runner.id, displayName: runner.displayName, supported: runner.supported } });
    }

    // Real run: create an execution row first, then spawn.
    const execution = await db.projectExecution.create({
      data: { projectId: id, action: opts.action, command: cmd.display, status: 'running', startedAt: new Date() },
    });

    try {
      const { pid, executionId } = await proc.start({ projectId: id, executionId: execution.id, cmd });
      await db.project.update({ where: { id }, data: { status: 'RUNNING', lastRunAt: new Date() } });
      await record({
        action: 'project.run', objectType: 'project', objectId: id, result: 'success',
        metadata: { pid, executionId, executable: cmd.executable, args: cmd.args, source: cmd.source, confidence: cmd.confidence },
      });
      return ok({ pid, executionId, runner: { id: runner.id, displayName: runner.displayName, supported: runner.supported }, command: cmd });
    } catch (e) {
      const reason = (e as Error).message;
      await db.projectExecution.update({ where: { id: execution.id }, data: { status: 'failed', reason, endedAt: new Date() } });
      await db.project.update({ where: { id }, data: { status: 'FAILED', lastFailureAt: new Date(), lastFailureReason: reason } });
      await record({ action: 'project.run', objectType: 'project', objectId: id, result: 'failure', reason });
      return err('INTERNAL', `Failed to start: ${reason}`, 500);
    }
  } catch (e) {
    const reason = (e as Error).message;
    await record({ action: 'project.run', objectType: 'project', objectId: id, result: 'failure', reason });
    return err('INTERNAL', `Run failed: ${reason}`, 500);
  }
}
