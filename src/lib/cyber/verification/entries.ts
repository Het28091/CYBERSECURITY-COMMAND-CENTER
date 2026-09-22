// Verify a knowledge entry by checking that its officialUrl is reachable
// (HTTP HEAD or GET with a small byte range) and returns 2xx/3xx.
// Records `lastVerifiedAt` and `verificationStatus` accordingly.
//
// This is genuine verification per master instruction section 5: we touch
// the authoritative source and confirm it still exists at the documented URL.
// We do NOT verify content (would require scraping + LLM, out of scope here).

import { db } from '@/lib/db';

const VERIFY_TIMEOUT_MS = 8000;

export type EntryKind = 'tool' | 'owasp' | 'ai' | 'framework';

interface Entry {
  id: string;
  officialUrl: string;
  verificationStatus: string;
  lastVerifiedAt: Date | null;
}

async function verifyUrl(url: string): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), VERIFY_TIMEOUT_MS);
  try {
    // Try HEAD first (cheaper); fall back to GET with a 1-byte range if HEAD not allowed.
    let res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      // Retry with a small range GET
      res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { Range: 'bytes=0-0' },
      });
    }
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status };
    }
    return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Verify one entry by its ID + kind. Updates the DB row.
 */
export async function verifyEntry(kind: EntryKind, id: string): Promise<{ ok: boolean; status: string; reason?: string }> {
  let entry: Entry | null;
  if (kind === 'tool')      entry = await db.securityTool.findUnique({ where: { id }, select: { id: true, officialUrl: true, verificationStatus: true, lastVerifiedAt: true } });
  else if (kind === 'owasp') entry = await db.owaspEntry.findUnique({ where: { id }, select: { id: true, officialUrl: true, verificationStatus: true, lastVerifiedAt: true } });
  else if (kind === 'ai')   entry = await db.aiSecurityEntry.findUnique({ where: { id }, select: { id: true, officialUrl: true, verificationStatus: true, lastVerifiedAt: true } });
  else                      entry = await db.complianceFramework.findUnique({ where: { id }, select: { id: true, officialUrl: true, verificationStatus: true, lastVerifiedAt: true } }) as any;

  if (!entry) return { ok: false, status: 'FAILED', reason: 'entry not found' };
  if (!entry.officialUrl) return { ok: false, status: 'FAILED', reason: 'no officialUrl' };

  // Mark VERIFYING while we check.
  await updateStatus(kind, id, 'VERIFYING', null);

  const result = await verifyUrl(entry.officialUrl);
  if (result.ok) {
    await updateStatus(kind, id, 'VERIFIED', new Date());
    return { ok: true, status: 'VERIFIED' };
  } else {
    await updateStatus(kind, id, 'FAILED', null, result.reason);
    return { ok: false, status: 'FAILED', reason: result.reason };
  }
}

async function updateStatus(kind: EntryKind, id: string, status: string, verifiedAt: Date | null, reason?: string) {
  if (kind === 'tool')      await db.securityTool.update({ where: { id }, data: { verificationStatus: status, lastVerifiedAt: verifiedAt } });
  else if (kind === 'owasp') await db.owaspEntry.update({ where: { id }, data: { verificationStatus: status, lastVerifiedAt: verifiedAt } });
  else if (kind === 'ai')   await db.aiSecurityEntry.update({ where: { id }, data: { verificationStatus: status, lastVerifiedAt: verifiedAt } });
  else                      await db.complianceFramework.update({ where: { id }, data: { verificationStatus: status, lastVerifiedAt: verifiedAt } });
}
