// GET /api/auth/session — returns the current user (or 401 if not authenticated)

import { NextRequest } from 'next/server';
import { ok, err } from '@/lib/cyber/api';
import { getSession, getAuthConfig } from '@/lib/cyber/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const config = getAuthConfig();
  const user = await getSession(req);
  if (!user) return err('UNAUTHORIZED', 'Not authenticated', 401);
  return ok({ user, authDisabled: config.disabled });
}
