// Threat Intelligence feed system.
// Master instruction section 7-8 requires a real, extensible feed system.
// Each indicator carries: source, type, value, timestamp, confidence,
// references, retrieval time, freshness, verification state.
//
// This module implements:
// - Feed registry (in DB: ThreatFeed model)
// - Feed adapters (one per format/source)
// - A refresh workflow that fetches, parses, and upserts indicators
// - Freshness + verification state tracking per indicator
//
// First feed: CISA KEV (Known Exploited Vulnerabilities) Catalog.
//   Source: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
//   Format: JSON
//   Free, public, no API key, authoritative (Tier 1).

import { db } from '@/lib/db';
import { redact } from '@/lib/cyber/security/redact';

export interface FeedAdapter {
  code: string;
  name: string;
  description: string;
  endpoint: string;
  format: 'json' | 'stix' | 'csv';
  fetch(): Promise<RawIndicator[]>;
}

export interface RawIndicator {
  type: 'cve' | 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'other';
  value: string;
  description?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence?: 'high' | 'medium' | 'low';
  references?: string[];
  publishedAt?: Date;
  rawJson?: string;
}

// ─── OSV Watchlist adapter ───────────────────────────────────────────────────
//
// This is the primary working feed in this sandbox environment. CISA KEV
// returns HTTP 403 and abuse.ch returns HTTP 401 from this network
// (documented environmental limitation). OSV.dev is reachable, so we use
// it as a "watchlist" feed: query OSV for a curated list of high-profile
// packages and persist the vulnerabilities as threat indicators (CVE/GHSA IDs).
//
// A real deployment would extend this list with their own package inventory.

const OSV_WATCHLIST = [
  ['npm', 'lodash'], ['npm', 'axios'], ['npm', 'express'], ['npm', 'next'],
  ['npm', 'react'], ['npm', 'request'], ['npm', 'minimist'], ['npm', 'ws'],
  ['npm', 'node-forge'], ['npm', 'dompurify'], ['npm', 'semver'], ['npm', 'jose'],
  ['PyPI', 'flask'], ['PyPI', 'django'], ['PyPI', 'cryptography'], ['PyPI', 'pyyaml'],
  ['PyPI', 'pillow'], ['PyPI', 'requests'], ['PyPI', 'jinja2'], ['PyPI', 'fastapi'],
  ['Maven', 'org.apache.logging.log4j:log4j-core'], ['Maven', 'org.springframework:spring-core'],
  ['Go', 'github.com/golang-jwt/jwt'], ['Go', 'github.com/gin-gonic/gin'],
  ['RubyGems', 'rails'], ['RubyGems', 'nokogiri'],
];

const OSV_BATCH_ENDPOINT = 'https://api.osv.dev/v1/querybatch';
const OSV_WATCHLIST_TIMEOUT_MS = 30000;

export const osvWatchlistAdapter: FeedAdapter = {
  code: 'osv-watchlist',
  name: 'OSV.dev Watchlist (curated high-profile packages)',
  description: 'Queries OSV.dev for a curated watchlist of high-profile packages and persists returned vulnerabilities as threat indicators. Tier-1 source (Google OSV). Free, no API key, works in restricted network environments.',
  endpoint: OSV_BATCH_ENDPOINT,
  format: 'json',
  async fetch(): Promise<RawIndicator[]> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), OSV_WATCHLIST_TIMEOUT_MS);
    try {
      const body = JSON.stringify({
        queries: OSV_WATCHLIST.map(([ecosystem, name]) => ({ package: { ecosystem, name } })),
      });
      const res = await fetch(OSV_BATCH_ENDPOINT, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
      });
      if (!res.ok) throw new Error(`OSV batch HTTP ${res.status}`);
      const data = await res.json() as { results?: { vulns?: { id: string; modified?: string }[] }[] };
      const results = data.results ?? [];
      const out: RawIndicator[] = [];
      for (let i = 0; i < results.length; i++) {
        const [ecosystem, name] = OSV_WATCHLIST[i];
        for (const v of results[i].vulns ?? []) {
          out.push({
            type: 'cve',
            value: v.id, // GHSA-... or CVE-...
            description: `Vulnerability in ${ecosystem}:${name}`,
            severity: 'high',
            confidence: 'high',
            references: [`https://osv.dev/vulnerability/${v.id}`],
            publishedAt: v.modified ? new Date(v.modified) : undefined,
            rawJson: JSON.stringify({ ecosystem, name, id: v.id }),
          });
        }
      }
      return out;
    } finally {
      clearTimeout(t);
    }
  },
};

// ─── abuse.ch ThreatFox adapter ────────────────────────────────────────────────
//
// NOTE: In this sandbox environment, the abuse.ch ThreatFox API returns
// HTTP 401 (Unauthorized). The adapter is left registered so that a user
// in an unrestricted environment can use it. (abuse.ch APIs sometimes
// require registration depending on the calling IP range.)

const THREATFOX_ENDPOINT = 'https://threatfox-api.abuse.ch/api/v1/';
const THREATFOX_FETCH_TIMEOUT_MS = 30000;

export const threatFoxAdapter: FeedAdapter = {
  code: 'abuse-ch-threatfox',
  name: 'abuse.ch ThreatFox',
  description: 'Community-driven IoC feed from abuse.ch covering malware C2 indicators (domains, IPs, URLs, hashes). Tier-1 open-source threat intelligence. Free, no API key.',
  endpoint: THREATFOX_ENDPOINT,
  format: 'json',
  async fetch(): Promise<RawIndicator[]> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), THREATFOX_FETCH_TIMEOUT_MS);
    try {
      // POST with query=get_iocs&days=1 to fetch the last 24h of IoCs.
      // Limit to 200 to keep the response manageable.
      const body = new URLSearchParams({ query: 'get_iocs', days: '1' });
      const res = await fetch(THREATFOX_ENDPOINT, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'CybersecurityCommandCenter/1.0 (local-first; security audit tool)',
        },
        body: body.toString(),
      });
      if (!res.ok) throw new Error(`ThreatFox HTTP ${res.status}`);
      const data = await res.json() as { query_status?: string; data?: any[] };
      if (data.query_status !== 'ok') throw new Error(`ThreatFox query_status: ${data.query_status}`);
      const iocs = data.data ?? [];
      return iocs.slice(0, 200).map((i: any): RawIndicator => {
        // ThreatFox `ioc_type` values: ip:port, domain, url, md5, sha1, sha256
        let type: RawIndicator['type'] = 'other';
        const t = String(i.ioc_type ?? '').toLowerCase();
        if (t.startsWith('ip')) type = 'ip';
        else if (t === 'domain') type = 'domain';
        else if (t === 'url') type = 'url';
        else if (t === 'md5' || t === 'sha1' || t === 'sha256') type = 'hash';
        return {
          type,
          value: String(i.ioc ?? '').trim(),
          description: `${i.malware_printable ?? 'unknown malware'}: ${i.malware_alias ?? ''}`.trim(),
          severity: 'high',
          confidence: i.confidence_level === 'high' ? 'high' : i.confidence_level === 'medium' ? 'medium' : 'low',
          references: [
            'https://threatfox.abuse.ch/',
            ...(i.ioc_id ? [`https://threatfox.abuse.ch/ioc/${i.ioc_id}`] : []),
          ],
          publishedAt: i.first_seen ? new Date(i.first_seen_utc ?? i.first_seen) : undefined,
          rawJson: JSON.stringify(i).slice(0, 4000),
        };
      }).filter((i) => i.value);
    } finally {
      clearTimeout(t);
    }
  },
};

// ─── CISA KEV adapter ─────────────────────────────────────────────────────────
// Note: in this sandbox environment, the CISA endpoint returns HTTP 403
// (likely edge firewall / Akamai bot detection). The adapter is left
// registered so a user with proxy access can use it.

const CISA_KEV_ENDPOINT = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const CISA_KEV_FETCH_TIMEOUT_MS = 30000;

export const cisaKevAdapter: FeedAdapter = {
  code: 'cisa-kev',
  name: 'CISA Known Exploited Vulnerabilities Catalog',
  description: 'CISA KEV — authoritative catalog of vulnerabilities known to be actively exploited. Tier-1 US government source. Free, public, no API key. NOTE: in some sandboxed networks this endpoint returns HTTP 403; use the abuse.ch ThreatFox feed as the working alternative.',
  endpoint: CISA_KEV_ENDPOINT,
  format: 'json',
  async fetch(): Promise<RawIndicator[]> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CISA_KEV_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(CISA_KEV_ENDPOINT, {
        signal: ctrl.signal,
        headers: {
          Accept: 'application/json',
          // CISA blocks requests with no User-Agent (HTTP 403).
          'User-Agent': 'CybersecurityCommandCenter/1.0 (local-first; security audit tool)',
        },
      });
      if (!res.ok) throw new Error(`CISA KEV HTTP ${res.status}`);
      const body = await res.json() as { vulnerabilities?: any[]; catalogVersion?: string; dateReleased?: string };
      const vulns = body.vulnerabilities ?? [];
      return vulns.map((v: any): RawIndicator => ({
        type: 'cve',
        value: String(v.cveID ?? '').trim(),
        description: v.shortDescription ?? v.vulnerabilityName ?? '',
        severity: v.knownRansomwareCampaignUse === 'Known' ? 'critical' : 'high',
        confidence: 'high',
        references: [
          'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
          ...(v.notes ? String(v.notes).split(/\s+/).filter((u: string) => u.startsWith('http')) : []),
        ].slice(0, 5),
        publishedAt: v.dateAdded ? new Date(v.dateAdded + 'T00:00:00Z') : undefined,
        rawJson: JSON.stringify(v).slice(0, 4000),
      })).filter((i) => i.value); // drop empty CVE IDs
    } finally {
      clearTimeout(t);
    }
  },
};

// ─── Registry ──────────────────────────────────────────────────────────────────

export const FEED_ADAPTERS: FeedAdapter[] = [osvWatchlistAdapter, threatFoxAdapter, cisaKevAdapter];

export function getAdapter(code: string): FeedAdapter | null {
  return FEED_ADAPTERS.find((a) => a.code === code) ?? null;
}

/**
 * Refresh a feed. Idempotent: upserts indicators by (feedId, type, value).
 * Updates feed freshness + indicator count.
 */
export async function refreshFeed(code: string): Promise<{
  ok: boolean;
  indicatorCount: number;
  freshness: 'fresh' | 'stale' | 'unknown';
  reason?: string;
}> {
  const adapter = getAdapter(code);
  if (!adapter) return { ok: false, indicatorCount: 0, freshness: 'unknown', reason: `unknown feed ${code}` };

  // Ensure the feed row exists.
  let feed = await db.threatFeed.findUnique({ where: { code } });
  if (!feed) {
    feed = await db.threatFeed.create({
      data: {
        code: adapter.code,
        name: adapter.name,
        description: adapter.description,
        endpoint: adapter.endpoint,
        format: adapter.format,
        trustTier: 1,
        enabled: true,
      },
    });
  }

  try {
    const rawIndicators = await adapter.fetch();
    let upserted = 0;
    for (const raw of rawIndicators) {
      // Lookup by (feedId, type, value) — upsert if found, else create.
      const existing = await db.threatIndicator.findFirst({
        where: { feedId: feed.id, type: raw.type, value: raw.value },
      });
      if (existing) {
        await db.threatIndicator.update({
          where: { id: existing.id },
          data: {
            description: raw.description ?? existing.description,
            severity: raw.severity ?? existing.severity,
            confidence: raw.confidence ?? existing.confidence,
            references: JSON.stringify(raw.references ?? []),
            publishedAt: raw.publishedAt ?? existing.publishedAt,
            retrievedAt: new Date(),
            verificationState: 'UNVERIFIED', // re-fetched, awaiting verification
            rawJson: raw.rawJson ?? existing.rawJson,
          },
        });
      } else {
        await db.threatIndicator.create({
          data: {
            feedId: feed.id,
            type: raw.type,
            value: raw.value,
            description: raw.description,
            severity: raw.severity,
            confidence: raw.confidence ?? 'medium',
            references: JSON.stringify(raw.references ?? []),
            publishedAt: raw.publishedAt,
            retrievedAt: new Date(),
            verificationState: 'UNVERIFIED',
            rawJson: raw.rawJson,
          },
        });
      }
      upserted++;
    }

    await db.threatFeed.update({
      where: { id: feed.id },
      data: {
        lastSuccessAt: new Date(),
        lastFailureReason: null,
        freshness: 'fresh',
        indicatorCount: upserted,
      },
    });

    return { ok: true, indicatorCount: upserted, freshness: 'fresh' };
  } catch (e) {
    const reason = redact((e as Error).message);
    await db.threatFeed.update({
      where: { id: feed.id },
      data: { lastFailureAt: new Date(), lastFailureReason: reason, freshness: 'stale' },
    });
    return { ok: false, indicatorCount: 0, freshness: 'stale', reason };
  }
}

/**
 * Get a feed's current freshness state. If last success was >24h ago, mark stale.
 */
export function computeFreshness(lastSuccessAt: Date | null): 'fresh' | 'stale' | 'unknown' {
  if (!lastSuccessAt) return 'unknown';
  const ageMs = Date.now() - lastSuccessAt.getTime();
  if (ageMs < 24 * 60 * 60 * 1000) return 'fresh';
  return 'stale';
}
