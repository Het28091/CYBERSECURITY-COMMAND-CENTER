// Vulnerabilities — like CVEs but framed as the project-focused view (lists
// registered projects first, then a search box). Forwards to /api/cves.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Loader2 } from 'lucide-react';
import { SeverityPill, FreshnessPill, SourceLabelPill } from '../pills';

export function VulnerabilitiesView() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const result = useQuery({
    queryKey: ['cves-vulns', submitted],
    queryFn: async () => { const r = await fetch(`/api/cves?q=${encodeURIComponent(submitted)}`); const j = await r.json(); return j.data; },
    enabled: submitted.length > 0,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vulnerabilities</h1>
        <p className="text-xs text-muted-foreground">Project-oriented lookup of known vulnerabilities. Same authoritative OSV.dev / NVD sources as the CVEs view, but oriented toward "what should I worry about in this dependency".</p>
      </div>
      <Card>
        <CardContent className="py-3 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. lodash, npm:express, CVE-2024-3094, pypi:cryptography" className="pl-8 text-xs font-mono" onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) setSubmitted(q.trim()); }} />
          </div>
          <Button size="sm" onClick={() => setSubmitted(q.trim())} disabled={!q.trim()}>Search</Button>
        </CardContent>
      </Card>

      {submitted && result.isLoading && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Querying external source…</div>}
      {result.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Results ({result.data.items?.length ?? 0})</span>
              <span className="flex items-center gap-2"><SourceLabelPill label={result.data.source === 'osv' || result.data.source === 'nvd' ? 'OFFICIAL_SOURCE' : 'UNVERIFIED'} /><FreshnessPill freshness={result.data.freshness} /></span>
            </CardTitle>
            <CardDescription className="text-xs font-mono">Source: {result.data.source} · Retrieved: {new Date(result.data.retrievalTime).toISOString()}</CardDescription>
          </CardHeader>
          <CardContent>
            {result.data.items?.length === 0 ? <div className="text-xs text-muted-foreground">No results from the upstream source.</div> : (
              <div className="space-y-1.5">
                {result.data.items?.map((v: any) => {
                  const sev = (Array.isArray(v.severity) ? (v.severity[0]?.type ?? '') : String(v.severity ?? '')).toLowerCase();
                  const sevStr = sev.includes('critical') ? 'critical' : sev.includes('high') ? 'high' : sev.includes('medium') || sev.includes('moderate') ? 'medium' : sev.includes('low') ? 'low' : 'info';
                  return (
                  <div key={v.id} className="border-l-2 border-border pl-2 py-1.5 text-xs">
                    <div className="flex items-center gap-2"><span className="font-mono font-medium">{v.id}</span><SeverityPill severity={sevStr} />{v.cvss && <span className="text-[10px] font-mono text-muted-foreground">CVSS {v.cvss}</span>}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{v.summary}</div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
