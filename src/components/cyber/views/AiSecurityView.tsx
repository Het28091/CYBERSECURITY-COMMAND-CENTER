// AI Security — list AI/LLM security entries.

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Bot } from 'lucide-react';
import { VerificationPill, SourceLabelPill } from '../pills';

export function AiSecurityView() {
  const entries = useQuery({
    queryKey: ['ai-security'],
    queryFn: async () => { const r = await fetch('/api/ai-security'); const j = await r.json(); return j.data ?? []; },
  });
  const all: any[] = entries.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI & LLM Security Center</h1>
        <p className="text-xs text-muted-foreground">Concepts covering prompt injection, jailbreaks, RAG security, agent security, model supply chain, and oversight. Each entry links to an authoritative source.</p>
      </div>
      {all.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><Bot className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" /><div className="text-xs font-mono text-muted-foreground">NO ENTRIES</div></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {all.map((e) => (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <a href={e.officialUrl} target="_blank" rel="noreferrer" className="font-mono font-medium hover:text-primary flex items-center gap-1.5"><Badge variant="outline" className="text-[10px] font-mono">{e.category}</Badge>{e.name}<ExternalLink className="h-3 w-3 inline" /></a>
                  <VerificationPill status={e.verificationStatus} />
                </CardTitle>
                <CardDescription className="text-[11px] font-mono">last verified: {e.lastVerifiedAt?.slice(0, 10) ?? 'unknown'}</CardDescription>
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
                <div className="pt-1"><SourceLabelPill label="OFFICIAL_SOURCE" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
