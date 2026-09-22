// POST /api/auth/login
// Body: { username: string, password: string }
// Sets a signed session cookie on success.
// Includes login rate limiting (5 failed attempts → 1 min lockout).

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { login, createSession, setSessionCookie, getAuthConfig } from '@/lib/cyber/auth';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const schema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const config = getAuthConfig();
  if (config.disabled) {
    return ok({ disabled: true, role: config.localRole, message: 'Auth is disabled (local-only mode). Session is implicit.' });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return parsed.error;

  const result = await login(parsed.data.username, parsed.data.password);

  if (result.lockedReason) {
    return err('TOO_MANY_ATTEMPTS', result.lockedReason, 429);
  }

  if (!result.user) {
    await record({ action: 'auth.login', objectType: 'auth', result: 'failure', reason: 'invalid credentials', metadata: { username: parsed.data.username } });
    return err('UNAUTHORIZED', 'Invalid username or password', 401);
  }

  const token = await createSession(result.user);
  const res = NextResponse.json({ ok: true, data: { user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role } } });
  setSessionCookie(res, token);
  await record({ action: 'auth.login', objectType: 'auth', objectId: result.user.id, result: 'success', metadata: { username: parsed.data.username, role: result.user.role } });
  return res;
}
