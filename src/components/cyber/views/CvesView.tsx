// CVEs — query OSV.dev / NVD by package name or CVE ID.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Search, Loader2, ExternalLink } from 'lucide-react';
import { FreshnessPill, SourceLabelPill, SeverityPill } from '../pills';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CvesView() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');

  const result = useQuery({
    queryKey: ['cves', submitted],
    queryFn: async () => { const r = await fetch(`/api/cves?q=${encodeURIComponent(submitted)}`); const j = await r.json(); return j.data; },
    enabled: submitted.length > 0,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">CVEs & Vulnerabilities</h1>
        <p className="text-xs text-muted-foreground">Live lookup against OSV.dev (by package) and NVD (by CVE ID). Authoritative Tier-1 sources only.</p>
      </div>

      <Card>
        <CardContent className="py-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='e.g. "lodash", "npm:axios", "CVE-2024-1234", "pypi:flask"' className="pl-8 text-xs font-mono" onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) setSubmitted(q.trim()); }} />
          </div>
          <Button size="sm" onClick={() => setSubmitted(q.trim())} disabled={!q.trim()}>Search</Button>
          <p className="text-[10px] text-muted-foreground">Format: bare package name (defaults to npm), <code>ecosystem:name</code>, or a CVE ID.</p>
        </CardContent>
      </Card>

      {submitted && result.isLoading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Querying external source…</div>
      )}

      {result.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Results ({result.data.items?.length ?? 0})</span>
              <span className="flex items-center gap-2">
                <SourceLabelPill label={result.data.source === 'osv' || result.data.source === 'nvd' ? 'OFFICIAL_SOURCE' : 'UNVERIFIED'} />
                <FreshnessPill freshness={result.data.freshness} />
              </span>
            </CardTitle>
            <CardDescription className="text-xs font-mono">Source: {result.data.source} · Retrieved: {new Date(result.data.retrievalTime).toISOString()} {result.data.error ? `· Error: ${result.data.error}` : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {result.data.items?.length === 0 ? (
              <div className="text-xs text-muted-foreground">No results from the upstream source. Try a different query, or the source may be rate-limiting.</div>
            ) : (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-2">
                  {result.data.items?.map((v: any) => {
                    const sev = (Array.isArray(v.severity) ? (v.severity[0]?.type ?? '') : String(v.severity ?? '')).toLowerCase();
                    const sevStr = sev.includes('critical') ? 'critical' : sev.includes('high') ? 'high' : sev.includes('medium') || sev.includes('moderate') ? 'medium' : sev.includes('low') ? 'low' : 'info';
                    return (
                    <div key={v.id} className="border-l-2 border-border pl-3 py-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-medium text-xs">{v.id}</span>
                        <SeverityPill severity={sevStr} />
                        {v.cvss && <span className="text-[10px] font-mono text-muted-foreground">CVSS {v.cvss}</span>}
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto">{v.published?.slice(0, 10)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{v.summary}</div>
                      {v.affected?.length > 0 && (
                        <div className="text-[10px] font-mono text-muted-foreground mt-1">
                          Affected: {v.affected.map((a: any) => `${a.package?.ecosystem}/${a.package?.name}`).slice(0, 3).join(', ')}
                        </div>
                      )}
                      {v.references?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {v.references.slice(0, 3).map((r: any, i: number) => (
                            <a key={i} href={r.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 font-mono"><ExternalLink className="h-2.5 w-2.5" />{(() => { try { return new URL(r.url).host } catch { return r.url.slice(0, 40) } })()}</a>
                          ))}
                        </div>
                      )}
                    </div>
                  ); })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
