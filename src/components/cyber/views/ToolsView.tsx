// Security Tools — searchable catalogue of cybersecurity tools.

import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Search, Wrench } from 'lucide-react';
import { VerificationPill, SourceLabelPill } from '../pills';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ToolsView() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const tools = useQuery({
    queryKey: ['tools', q, category],
    queryFn: async () => {
      const url = new URL('/api/tools', location.origin);
      if (q) url.searchParams.set('q', q);
      if (category) url.searchParams.set('category', category);
      const r = await fetch(url.toString()); const j = await r.json(); return j.data ?? [];
    },
  });
  const all: any[] = tools.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Security Tools</h1>
        <p className="text-xs text-muted-foreground">Authoritative catalogue of cybersecurity tools with official source links. {all.length} tools.</p>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools by name…" className="pl-8 text-xs" />
        </div>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category…" className="w-[160px] text-xs" />
      </div>
      {all.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><Wrench className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" /><div className="text-xs font-mono text-muted-foreground">NO TOOLS MATCH</div></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {all.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <a href={t.officialUrl} target="_blank" rel="noreferrer" className="font-mono font-medium hover:text-primary truncate flex items-center gap-1.5">{t.name}<ExternalLink className="h-3 w-3 inline" /></a>
                  <VerificationPill status={t.verificationStatus} />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="text-[11px] text-muted-foreground">{t.purpose}</div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px] font-mono">{t.category}</Badge>
                  {(t.tags ?? []).map((tag: string) => <Badge key={tag} variant="secondary" className="text-[10px] font-mono">{tag}</Badge>)}
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground font-mono">
                  {(t.platforms ?? []).map((p: string) => <span key={p} className="px-1.5 py-0.5 rounded bg-muted/30">{p}</span>)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground/70 font-mono">{t.license ?? 'license unknown'}</span>
                  <SourceLabelPill label="OFFICIAL_SOURCE" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
