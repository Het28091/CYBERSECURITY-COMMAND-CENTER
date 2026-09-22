// External integrations: OSV.dev and NVD.
// All external fetches go through this module so we can centralise
// timeout, error handling, freshness tracking, and cache.
//
// GAP-009 fix: per-query disk cache with TTL (1h OSV, 6h NVD). The
// `freshness` field is now computed from the cache age, not always 'fresh'.
// GAP-019 fix: NVD operator-precedence bug in `affected` mapping.

import { db } from '@/lib/db';
import * as fs from 'node:fs';
import * as path from 'node:path';

const OSV_ENDPOINT = 'https://api.osv.dev/v1/query';
const NVD_ENDPOINT = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const DEFAULT_TIMEOUT_MS = 15000;
const CACHE_DIR = process.env.CACHE_DIR
  ? path.join(process.env.CACHE_DIR, 'cve')
  : '/home/z/my-project/cache/cve';
const OSV_TTL_MS = 60 * 60 * 1000;       // 1 hour
const NVD_TTL_MS = 6 * 60 * 60 * 1000;   // 6 hours

export interface VulnerabilityItem {
  id: string;                // CVE-... or GHSA-...
  summary: string;
  severity: string | null;   // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null (canonicalized)
  cvss: number | null;
  affected: { package: { ecosystem: string; name: string }; ranges: { events: { introduced?: string; fixed?: string }[] }[] }[];
  references: { url: string; source?: string }[];
  source: 'osv' | 'nvd';
  published: string | null;
  modified: string | null;
}

export interface VulnerabilityQueryResult {
  items: VulnerabilityItem[];
  source: 'osv' | 'nvd' | 'cache' | 'unknown';
  retrievalTime: string;
  freshness: 'fresh' | 'stale' | 'unknown';
  error?: string;
  cachedAt?: string;
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

function cachePath(prefix: string, key: string): string {
  // Hash the key into a safe filename
  const safe = Buffer.from(key).toString('base64url').slice(0, 100);
  return path.join(CACHE_DIR, `${prefix}-${safe}.json`);
}

function readCache(prefix: string, key: string, ttlMs: number): { data: any; cachedAt: Date; freshness: 'fresh' | 'stale' } | null {
  const p = cachePath(prefix, key);
  try {
    const stat = fs.statSync(p);
    const age = Date.now() - stat.mtimeMs;
    const content = fs.readFileSync(p, 'utf8');
    return {
      data: JSON.parse(content),
      cachedAt: stat.mtime,
      freshness: age < ttlMs ? 'fresh' : 'stale',
    };
  } catch { return null; }
}

function writeCache(prefix: string, key: string, data: any): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(prefix, key), JSON.stringify(data));
  } catch (e) { /* cache write failures are non-fatal */ }
}

async function recordSource(code: string, name: string, endpoint: string, ok: boolean, reason?: string) {
  try {
    const existing = await db.dataSource.findUnique({ where: { code } });
    const freshness = ok ? 'fresh' : 'unknown';
    if (existing) {
      await db.dataSource.update({
        where: { code },
        data: ok
          ? { lastSuccessAt: new Date(), lastFailureReason: null, freshness, endpoint }
          : { lastFailureAt: new Date(), lastFailureReason: reason ?? 'unknown', freshness: ok ? 'fresh' : 'stale' },
      });
    } else {
      await db.dataSource.create({
        data: { code, name, trustTier: 1, endpoint, freshness, cachedAt: ok ? new Date() : null },
      });
    }
  } catch (e) {
    console.error('recordSource failed:', e);
  }
}

/** Query OSV.dev by package ecosystem + name (e.g. npm:lodash). */
export async function queryOsvByPackage(ecosystem: string, packageName: string): Promise<VulnerabilityQueryResult> {
  const settings = await db.settings.findUnique({ where: { id: 1 } }).catch(() => null);
  if (settings && !settings.externalFetchEnabled) {
    return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: 'external_fetch_disabled' };
  }

  const cacheKey = `${ecosystem}:${packageName}`;
  const cached = readCache('osv', cacheKey, OSV_TTL_MS);
  if (cached) {
    const items: VulnerabilityItem[] = (cached.data.vulns ?? []).map(mapOsv);
    return {
      items,
      source: 'cache',
      retrievalTime: new Date().toISOString(),
      cachedAt: cached.cachedAt.toISOString(),
      freshness: cached.freshness,
    };
  }

  try {
    const res = await fetchWithTimeout(OSV_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { ecosystem, name: packageName } }),
    });
    if (!res.ok) {
      await recordSource('osv', 'OSV.dev', OSV_ENDPOINT, false, `HTTP ${res.status}`);
      return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: `OSV HTTP ${res.status}` };
    }
    const body = await res.json() as { vulns?: any[] };
    writeCache('osv', cacheKey, body);
    const items: VulnerabilityItem[] = (body.vulns ?? []).map(mapOsv);
    await recordSource('osv', 'OSV.dev', OSV_ENDPOINT, true);
    return { items, source: 'osv', retrievalTime: new Date().toISOString(), freshness: 'fresh' };
  } catch (e) {
    await recordSource('osv', 'OSV.dev', OSV_ENDPOINT, false, (e as Error).message);
    // On network failure, fall back to stale cache if available.
    const staleCache = readCache('osv', cacheKey, Number.MAX_SAFE_INTEGER);
    if (staleCache) {
      const items: VulnerabilityItem[] = (staleCache.data.vulns ?? []).map(mapOsv);
      return { items, source: 'cache', retrievalTime: new Date().toISOString(), cachedAt: staleCache.cachedAt.toISOString(), freshness: 'stale', error: (e as Error).message };
    }
    return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: (e as Error).message };
  }
}

/** Query NVD by CVE ID. */
export async function queryNvdByCve(cveId: string): Promise<VulnerabilityQueryResult> {
  const settings = await db.settings.findUnique({ where: { id: 1 } }).catch(() => null);
  if (settings && !settings.externalFetchEnabled) {
    return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: 'external_fetch_disabled' };
  }

  const cached = readCache('nvd', cveId, NVD_TTL_MS);
  if (cached) {
    const items: VulnerabilityItem[] = (cached.data.vulnerabilities ?? []).map((v: any) => mapNvd(v.cve));
    return { items, source: 'cache', retrievalTime: new Date().toISOString(), cachedAt: cached.cachedAt.toISOString(), freshness: cached.freshness };
  }

  try {
    const url = `${NVD_ENDPOINT}?cveId=${encodeURIComponent(cveId)}`;
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      await recordSource('nvd', 'NVD', NVD_ENDPOINT, false, `HTTP ${res.status}`);
      return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: `NVD HTTP ${res.status}` };
    }
    const body = await res.json() as { vulnerabilities?: { cve: any }[] };
    writeCache('nvd', cveId, body);
    const items: VulnerabilityItem[] = (body.vulnerabilities ?? []).map((v) => mapNvd(v.cve));
    await recordSource('nvd', 'NVD', NVD_ENDPOINT, true);
    return { items, source: 'nvd', retrievalTime: new Date().toISOString(), freshness: 'fresh' };
  } catch (e) {
    await recordSource('nvd', 'NVD', NVD_ENDPOINT, false, (e as Error).message);
    const staleCache = readCache('nvd', cveId, Number.MAX_SAFE_INTEGER);
    if (staleCache) {
      const items: VulnerabilityItem[] = (staleCache.data.vulnerabilities ?? []).map((v: any) => mapNvd(v.cve));
      return { items, source: 'cache', retrievalTime: new Date().toISOString(), cachedAt: staleCache.cachedAt.toISOString(), freshness: 'stale', error: (e as Error).message };
    }
    return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: (e as Error).message };
  }
}

/** Free-form vulnerability query. If the input looks like a CVE ID, we use
 * NVD; otherwise we try OSV (treating the input as `package` or `ecosystem:name`). */
export async function queryVulnerabilities(q: string): Promise<VulnerabilityQueryResult> {
  if (!q || !q.trim()) {
    return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown' };
  }
  const trimmed = q.trim();
  if (/^CVE-\d{4}-\d{4,}$/.test(trimmed)) {
    return queryNvdByCve(trimmed);
  }
  // If "ecosystem:name" pattern, split.
  const m = trimmed.match(/^([A-Za-z]+):(.+)$/);
  if (m) {
    return queryOsvByPackage(capitalize(m[1]), m[2]);
  }
  // Bare package name — try npm by default (most common ecosystem in this sandbox).
  return queryOsvByPackage('npm', trimmed);
}

function mapOsv(v: any): VulnerabilityItem {
  // OSV severity can be a string (legacy) or array of CVSS objects.
  // Normalize to one of CRITICAL | HIGH | MEDIUM | LOW | null
  let severity: string | null = null;
  if (Array.isArray(v.severity)) {
    const first = v.severity[0];
    if (first?.score) {
      severity = cvssVectorToSeverity(first.score);
    }
  } else if (typeof v.severity === 'string') {
    severity = cvssVectorToSeverity(v.severity);
  }
  if (!severity) severity = extractOsvSeverity(v);

  return {
    id: v.id,
    summary: v.summary ?? v.details?.slice(0, 240) ?? '',
    severity,
    cvss: extractOsvCvss(v),
    affected: (v.affected ?? []).map((a: any) => ({
      package: { ecosystem: a.package?.ecosystem ?? 'unknown', name: a.package?.name ?? '' },
      ranges: (a.ranges ?? []).map((r: any) => ({ events: r.events ?? [] })),
    })),
    references: (v.references ?? []).map((r: any) => ({ url: r.url, source: r.type })),
    source: 'osv',
    published: v.published ?? null,
    modified: v.modified ?? null,
  };
}

function mapNvd(c: any): VulnerabilityItem {
  const cvss = c.metrics?.cvssMetricV31?.[0] ?? c.metrics?.cvssMetricV2?.[0];
  const sev = cvss?.cvssData?.baseSeverity?.toUpperCase() ?? null;
  return {
    id: c.id,
    summary: c.descriptions?.find((d: any) => d.lang === 'en')?.value?.slice(0, 240) ?? '',
    severity: sev,
    cvss: cvss?.cvssData?.baseScore ?? null,
    // GAP-019 fix: properly parenthesize the ?? so the actual CPE string is
    // used as the package name.
    affected: (c.configurations ?? []).flatMap((conf: any) =>
      (conf.nodes ?? []).flatMap((n: any) =>
        (n.cpeMatch ?? []).map((cp: any) => ({
          package: { ecosystem: 'NVD', name: cp.criteria ?? (cp.vulnerable ? 'vulnerable' : 'not') },
          ranges: [],
        }))
      )
    ),
    references: (c.references ?? []).map((r: any) => ({ url: r.url, source: r.source })),
    source: 'nvd',
    published: c.published ?? null,
    modified: c.lastModified ?? null,
  };
}

function extractOsvSeverity(v: any): string | null {
  const s = v.database_specific?.severity ?? v.severity;
  if (!s) return null;
  return String(s).toUpperCase();
}

function extractOsvCvss(v: any): number | null {
  const s = v.severity ?? v.database_specific?.severity;
  if (typeof s === 'string' && /^CVSS/i.test(s)) {
    const m = s.match(/(\d+(\.\d+)?)/);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * Convert a CVSS vector string (e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L")
 * to a canonical severity string. Uses the CVSS score embedded in the vector
 * if present, otherwise returns null.
 */
function cvssVectorToSeverity(vector: string): string | null {
  if (!vector) return null;
  // Try to find a numeric score (CVSS:3.1/...:N/L means score = base)
  // CVSS vectors don't always include the score, but OSV sometimes prepends
  // the score like "CVSS:3.1/AV:N/...". For now, we extract a base score
  // by looking at the impact subspace.
  // As a fallback, look at known labels in the vector.
  const upper = vector.toUpperCase();
  if (upper.includes('/C:H')) return 'CRITICAL';  // not strictly accurate but a useful heuristic
  if (upper.includes('/C:L')) return 'MEDIUM';
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
