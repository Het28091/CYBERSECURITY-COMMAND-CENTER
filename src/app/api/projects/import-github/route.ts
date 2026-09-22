// POST /api/projects/import-github — import a GitHub repository as a project.
// Body: { repoUrl, branch?, accessToken?, name, description?, category?, tags?, dryRun? }
// See src/lib/cyber/github/import.ts for the workflow + isolation model.

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { importGitHubProject } from '@/lib/cyber/github/import';
import { requireAuth } from '@/lib/cyber/auth';
import { record } from '@/lib/cyber/audit/record';
import { redact } from '@/lib/cyber/security/redact';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const schema = z.object({
  repoUrl: z.string().min(1).max(2048),
  branch: z.string().max(200).optional(),
  accessToken: z.string().max(200).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const __auth = await requireAuth(req, 'create');
  if (!__auth.ok) return __auth.response!;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return parsed.error;

  // Never log the access token in the audit trail.
  const auditedInput = { ...parsed.data, accessToken: parsed.data.accessToken ? '<redacted>' : undefined };

  const result = await importGitHubProject(parsed.data);

  if (!result.ok) {
    await record({
      action: 'project.add-github', objectType: 'project', result: 'failure',
      reason: result.error, metadata: auditedInput,
    });
    return err('GITHUB_IMPORT_FAILED', result.error ?? 'Unknown error', 422);
  }

  return ok(result);
}
