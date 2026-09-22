// ThreatIntelView — connects to the real threat-intelligence backend.
// Shows:
// - Feed list with honest health states (AVAILABLE/UNAVAILABLE/BLOCKED/NOT_CONFIGURED/STALE)
// - Indicators from the feeds (source, type, value, timestamp, freshness, confidence, references, verification status)
// - Refresh buttons per feed
// - Clear distinction: vulnerability intelligence (OSV/NVD) ≠ threat intelligence (IoC feeds)
// - No manufactured feed data

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Radar, RefreshCw, ExternalLink, Loader2, AlertTriangle, ShieldCheck, ShieldX, ShieldAlert, Clock, RadioTower } from 'lucide-react';
import { toast } from 'sonner';

const HEALTH_META: Record<string, { cls: string; icon: any; label: string }> = {
  AVAILABLE:      { cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', icon: ShieldCheck, label: 'AVAILABLE' },
  UNAVAILABLE:    { cls: 'text-red-400 border-red-500/40 bg-red-500/10', icon: ShieldX, label: 'UNAVAILABLE' },
  BLOCKED:        { cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10', icon: ShieldAlert, label: 'BLOCKED' },
  NOT_CONFIGURED: { cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10', icon: Clock, label: 'NOT_CONFIGURED' },
  STALE:          { cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10', icon: Clock, label: 'STALE' },
};

export function ThreatIntelView() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const feeds = useQuery({
    queryKey: ['threat-feeds'],
    queryFn: async () => { const r = await fetch('/api/threat-intel/feeds'); const j = await r.json(); return j.data ?? []; },
    refetchInterval: 30000,
  });

  const indicators = useQuery({
    queryKey: ['threat-indicators', q, severityFilter],
    queryFn: async () => {
      const url = new URL('/api/threat-intel/indicators', location.origin);
      url.searchParams.set('limit', '200');
      if (q) url.searchParams.set('q', q);
      if (severityFilter) url.searchParams.set('severity', severityFilter);
      const r = await fetch(url.toString());
      const j = await r.json();
      return j.data ?? [];
    },
  });

  async function refreshFeed(id: string, code: string) {
    setRefreshing(code);
    try {
      const r = await fetch(`/api/threat-intel/feeds/${id}/refresh`, { method: 'POST' });
      const j = await r.json();
      if (j.data?.ok) {
        toast.success(`Feed "${code}" refreshed: ${j.data.indicatorCount} indicators`);
      } else {
        toast.warning(`Feed "${code}": ${j.data?.reason ?? 'refresh failed'}`);
      }
    } catch (e) {
      toast.error(`Refresh ${code}: ${(e as Error).message}`);
    } finally {
      setRefreshing(null);
      qc.invalidateQueries({ queryKey: ['threat-feeds'] });
      qc.invalidateQueries({ queryKey: ['threat-indicators'] });
    }
  }

  const allFeeds: any[] = feeds.data ?? [];
  const allIndicators: any[] = indicators.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Threat Intelligence</h1>
        <p className="text-xs text-muted-foreground">
          Indicator-of-Compromise (IoC) feeds from authoritative sources. Each feed shows its honest health state.
          Vulnerability intelligence (OSV.dev / NVD) is separate — use the CVEs view for that.
        </p>
      </div>

      {/* Disclaimer: vulnerability intel ≠ threat intel */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="py-3 text-xs flex items-start gap-2">
          <Radar className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-blue-200/90">
            <strong>Threat Intelligence ≠ Vulnerability Intelligence.</strong> Threat intel covers IoCs (malicious IPs, domains, URLs, hashes, CVEs known to be exploited).
            Vulnerability intel covers known software defects (use the <b>CVEs</b> or <b>Vulnerabilities</b> view for OSV.dev / NVD).
            The OSV Watchlist feed below queries OSV.dev for a curated list of high-profile packages — its indicators are CVE/GHSA IDs, which bridge both domains.
          </div>
        </CardContent>
      </Card>

      {/* Feed health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><RadioTower className="h-4 w-4" /> Feeds ({allFeeds.length})</CardTitle>
          <CardDescription className="text-xs">
            Health states: <span className="text-emerald-400">AVAILABLE</span> · <span className="text-amber-400">STALE</span> · <span className="text-red-400">UNAVAILABLE</span> · <span className="text-amber-400">BLOCKED</span> · <span className="text-slate-400">NOT_CONFIGURED</span>.
            BLOCKED means the feed endpoint refused the request (HTTP 403/401) — the system does not manufacture data to hide this.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allFeeds.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No feeds registered.</div>
            ) : allFeeds.map((f) => {
              const hm = HEALTH_META[f.healthState] ?? HEALTH_META.NOT_CONFIGURED;
              const HIcon = hm.icon;
              return (
                <div key={f.id} className="flex items-center gap-3 border-b border-border/30 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-medium">{f.code}</span>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded border ${hm.cls}`}>
                        <HIcon className="h-2.5 w-2.5" />{hm.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{f.description.slice(0, 120)}</div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                      <span>indicators: {f.indicatorCount}</span>
                      {f.lastSuccessAt && <span>last ok: {new Date(f.lastSuccessAt).toISOString().slice(0,16).replace('T',' ')}Z</span>}
                      {f.lastFailureAt && <span className="text-red-400/70">last fail: {new Date(f.lastFailureAt).toISOString().slice(0,16).replace('T',' ')}Z</span>}
                      {f.lastFailureReason && <span className="text-amber-400/70 truncate max-w-[300px]">{f.lastFailureReason.slice(0, 80)}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => refreshFeed(f.id, f.code)}
                    disabled={refreshing === f.code}
                    className="shrink-0"
                  >
                    {refreshing === f.code ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                    Refresh
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Indicators */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Radar className="h-4 w-4" /> Indicators ({allIndicators.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Each indicator carries: source, type, value, timestamp, freshness, confidence, references, verification state.
            Verification state is UNVERIFIED by default (never auto-VERIFIED).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by indicator value…" className="text-xs font-mono" />
            </div>
            <Input value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} placeholder="severity (high/medium/low)" className="w-40 text-xs" />
          </div>

          {indicators.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4"><Loader2 className="h-3 w-3 animate-spin" /> Loading indicators…</div>
          ) : allIndicators.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No indicators. Refresh a feed above to fetch indicators.
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-1.5">
                {allIndicators.slice(0, 200).map((i) => (
                  <div key={i.id} className="border-l-2 border-border pl-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono">{i.type}</Badge>
                      {i.severity && (
                        <Badge variant="outline" className={`text-[10px] font-mono ${
                          i.severity === 'critical' ? 'text-red-400 border-red-500/40' :
                          i.severity === 'high' ? 'text-orange-400 border-orange-500/40' :
                          i.severity === 'medium' ? 'text-amber-400 border-amber-500/40' :
                          'text-slate-400 border-slate-500/40'
                        }`}>{i.severity.toUpperCase()}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">{i.feedCode}</Badge>
                      <span className="text-[10px] text-muted-foreground/70 font-mono ml-auto">
                        {i.publishedAt ? `pub: ${new Date(i.publishedAt).toISOString().slice(0,10)}` : ''} · retr: {new Date(i.retrievedAt).toISOString().slice(0,16).replace('T',' ')}Z
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-foreground/90 break-all">{i.value}</div>
                    {i.description && <div className="text-[10px] text-muted-foreground mt-0.5">{i.description.slice(0, 200)}</div>}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                      <span>conf: {i.confidence}</span>
                      <span>verify: {i.verificationState}</span>
                      {(i.references ?? []).slice(0, 2).map((ref: string, idx: number) => (
                        <a key={idx} href={ref} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                          <ExternalLink className="h-2 w-2" /> ref
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Authoritative external sources (informational, not live feeds) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Authoritative external sources (informational)</CardTitle>
          <CardDescription className="text-xs">These are authoritative sources for manual threat intelligence research. They are not configured as automated feeds — use the feeds above for automated ingestion.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { name: 'MITRE ATT&CK', url: 'https://attack.mitre.org/', desc: 'Tactics, techniques, and procedures.' },
              { name: 'CISA KEV Catalog', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', desc: 'US CISA Known Exploited Vulnerabilities.' },
              { name: 'NIST NVD', url: 'https://nvd.nist.gov/', desc: 'National Vulnerability Database.' },
              { name: 'OSV.dev', url: 'https://osv.dev/', desc: 'Open Source Vulnerability database (used by this app).' },
            ].map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 border rounded hover:bg-muted/30 text-xs">
                <ExternalLink className="h-3 w-3 text-primary shrink-0" />
                <div>
                  <div className="font-mono font-medium">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
