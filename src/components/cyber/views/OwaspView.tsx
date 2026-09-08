// OWASP — list OWASP knowledge entries (Web 2021, API 2023, LLM 2025).

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Shield } from 'lucide-react';
import { VerificationPill, SourceLabelPill, FreshnessPill } from '../pills';
import { ScrollArea } from '@/components/ui/scroll-area';

export function OwaspView() {
  const [list, setList] = useState('web-2021');

  const entries = useQuery({
    queryKey: ['owasp', list],
    queryFn: async () => { const r = await fetch(`/api/owasp?list=${list}`); const j = await r.json(); return j.data ?? []; },
  });
  const all: any[] = entries.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">OWASP Knowledge</h1>
        <p className="text-xs text-muted-foreground">Each entry links to the official OWASP source. We summarise; the source remains authoritative.</p>
      </div>
      <Tabs value={list} onValueChange={setList}>
        <TabsList className="text-xs">
          <TabsTrigger value="web-2021" className="text-xs">Web Top 10 — 2021</TabsTrigger>
          <TabsTrigger value="api-2023" className="text-xs">API Top 10 — 2023</TabsTrigger>
          <TabsTrigger value="llm-2025" className="text-xs">LLM Top 10 — 2025</TabsTrigger>
        </TabsList>
        <TabsContent value={list}>
          <div className="space-y-2 mt-3">
            {all.length === 0 ? (
              <Card><CardContent className="py-8 text-center"><Shield className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" /><div className="text-xs font-mono text-muted-foreground">NO ENTRIES</div></CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {all.map((e) => (
                  <Card key={e.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <a href={e.officialUrl} target="_blank" rel="noreferrer" className="font-mono font-medium hover:text-primary flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] font-mono">{e.rank}</Badge>{e.name}<ExternalLink className="h-3 w-3 inline" />
                        </a>
                        <VerificationPill status={e.verificationStatus} />
                      </CardTitle>
                      <CardDescription className="text-[11px] font-mono">list: {e.list} · last verified: {e.lastVerifiedAt?.slice(0, 10)}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2">
                      <div>{e.summary}</div>
                      {e.mitigations?.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Mitigations</div>
                          <ul className="text-[11px] space-y-0.5">
                            {e.mitigations.map((m: string, i: number) => <li key={i} className="flex items-start gap-2"><span className="text-primary">▸</span><span>{m}</span></li>)}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <SourceLabelPill label="OFFICIAL_SOURCE" />
                        <FreshnessPill freshness="fresh" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
