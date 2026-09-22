// POST /api/auth/logout — revoke session server-side + clear cookie.
//
// F-001 fix (Spiral 21): The logout now calls revokeSession() which marks
// the DB Session row as revoked. After this, any request with the old
// cookie will fail getSession() because the DB check finds revokedAt != null.
// A stolen cookie replayed after logout returns 401.

import { NextRequest } from 'next/server';
import { ok } from '@/lib/cyber/api';
import { clearSessionCookie, getSession, revokeSession } from '@/lib/cyber/auth';
import { record } from '@/lib/cyber/audit/record';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getSession(req);

  // F-001 fix: revoke the session in the DB so the old cookie cannot be replayed.
  if (user) {
    await revokeSession(req);
  }

  const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
  clearSessionCookie(res);
  await record({ action: 'auth.logout', objectType: 'auth', objectId: user?.id, result: 'success', metadata: { sessionRevoked: !!user } });
  return res;
}
