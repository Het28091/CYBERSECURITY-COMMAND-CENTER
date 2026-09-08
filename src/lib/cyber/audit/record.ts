// Audit trail module.
// Append-only audit event recorder.

import { db } from '@/lib/db';
import { redact } from '@/lib/cyber/security/redact';

export interface RecordArgs {
  actor?: string;
  action: string;
  objectType: string;
  objectId?: string | null;
  result: 'success' | 'failure';
  reason?: string | null;
  metadata?: Record<string, unknown>;
  projectId?: string | null;
}

export async function record(args: RecordArgs): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actor: args.actor ?? 'local-user',
        action: args.action,
        objectType: args.objectType,
        objectId: args.objectId ?? null,
        result: args.result,
        reason: args.reason ?? null,
        metadata: JSON.stringify(args.metadata ? redactObjectShallow(args.metadata) : {}),
        projectId: args.projectId ?? null,
      },
    });
  } catch (e) {
    // Audit failures must never crash the request, but must be surfaced.
    console.error('audit.record failed:', e);
  }
}

function redactObjectShallow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = redact(v);
    else if (v && typeof v === 'object') out[k] = JSON.parse(redact(JSON.stringify(v)));
    else out[k] = v;
  }
  return out;
}
