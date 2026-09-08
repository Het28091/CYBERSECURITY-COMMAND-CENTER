// External integrations: OSV.dev and NVD.
// All external fetches go through this module so we can centralise
// timeout, error handling, freshness tracking, and cache.

import { db } from '@/lib/db';

const OSV_ENDPOINT = 'https://api.osv.dev/v1/query';
const NVD_ENDPOINT = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const DEFAULT_TIMEOUT_MS = 15000;

export interface VulnerabilityItem {
  id: string;                // CVE-... or GHSA-...
  summary: string;
  severity: string | null;   // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null
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
    const items: VulnerabilityItem[] = (body.vulns ?? []).map(mapOsv);
    await recordSource('osv', 'OSV.dev', OSV_ENDPOINT, true);
    return { items, source: 'osv', retrievalTime: new Date().toISOString(), freshness: 'fresh' };
  } catch (e) {
    await recordSource('osv', 'OSV.dev', OSV_ENDPOINT, false, (e as Error).message);
    return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: (e as Error).message };
  }
}

/** Query NVD by CVE ID. */
export async function queryNvdByCve(cveId: string): Promise<VulnerabilityQueryResult> {
  const settings = await db.settings.findUnique({ where: { id: 1 } }).catch(() => null);
  if (settings && !settings.externalFetchEnabled) {
    return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: 'external_fetch_disabled' };
  }
  try {
    const url = `${NVD_ENDPOINT}?cveId=${encodeURIComponent(cveId)}`;
    const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      await recordSource('nvd', 'NVD', NVD_ENDPOINT, false, `HTTP ${res.status}`);
      return { items: [], source: 'unknown', retrievalTime: new Date().toISOString(), freshness: 'unknown', error: `NVD HTTP ${res.status}` };
    }
    const body = await res.json() as { vulnerabilities?: { cve: any }[] };
    const items: VulnerabilityItem[] = (body.vulnerabilities ?? []).map((v) => mapNvd(v.cve));
    await recordSource('nvd', 'NVD', NVD_ENDPOINT, true);
    return { items, source: 'nvd', retrievalTime: new Date().toISOString(), freshness: 'fresh' };
  } catch (e) {
    await recordSource('nvd', 'NVD', NVD_ENDPOINT, false, (e as Error).message);
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
  const sev = v.severity ?? (v.severity ? String(v.severity).toUpperCase() : null);
  return {
    id: v.id,
    summary: v.summary ?? v.details?.slice(0, 240) ?? '',
    severity: sev ?? extractOsvSeverity(v),
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
    affected: (c.configurations ?? []).flatMap((conf: any) =>
      (conf.nodes ?? []).flatMap((n: any) =>
        (n.cpeMatch ?? []).map((cp: any) => ({
          package: { ecosystem: 'NVD', name: cp.criteria ?? cp.vulnerable ? 'vulnerable' : 'not' },
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
