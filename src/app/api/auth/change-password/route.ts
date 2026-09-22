// POST /api/auth/change-password
// Body: { currentPassword: string, newPassword: string }
// Requires authentication (admin action).
// After successful password change, ALL sessions are revoked — the user must re-login.

import { NextRequest } from 'next/server';
import { ok, err, parseBody } from '@/lib/cyber/api';
import { changePassword, requireAuth, clearSessionCookie } from '@/lib/cyber/auth';
import { record } from '@/lib/cyber/audit/record';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  // Require authentication — only authenticated users can change password.
  const auth = await requireAuth(req, 'admin');
  if (!auth.ok) return auth.response!;

  const body = await req.json().catch(() => null);
  const parsed = parseBody(schema, body);
  if (!parsed.ok) return parsed.error;

  const result = await changePassword(parsed.data.currentPassword, parsed.data.newPassword);

  if (!result.ok) {
    await record({
      action: 'auth.change-password', objectType: 'auth', result: 'failure',
      reason: result.reason, metadata: { username: auth.user?.id },
    });
    return err('PASSWORD_CHANGE_FAILED', result.reason ?? 'Password change failed', 400);
  }

  // Clear the session cookie since all sessions are now revoked.
  const res = NextResponse.json({ ok: true, data: { changed: true, message: 'Password changed. All sessions revoked. Please log in again.' } });
  clearSessionCookie(res);

  await record({
    action: 'auth.change-password', objectType: 'auth', objectId: auth.user?.id, result: 'success',
    metadata: { sessionsRevoked: true },
  });

  return res;
}
