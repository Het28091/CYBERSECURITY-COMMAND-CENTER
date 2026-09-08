// Findings — aggregated findings across all projects.

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bug } from 'lucide-react';
import { SeverityPill } from '../pills';
import { Badge } from '@/components/ui/badge';

export function FindingsView() {
  const projects = useQuery({
    queryKey: ['projects-all'],
    queryFn: async () => { const r = await fetch('/api/projects?limit=500'); const j = await r.json(); return j.data ?? []; },
  });

  const projectsWithFindings = (projects.data ?? []).filter((p: any) => p.findingCount > 0);
  const findingsByProject = useQuery({
    queryKey: ['all-findings', projectsWithFindings.map((p: any) => p.id).join(',')],
    queryFn: async () => {
      const out: Record<string, any[]> = {};
      await Promise.all(projectsWithFindings.map(async (p: any) => {
        const r = await fetch(`/api/projects/${p.id}/findings?limit=200`);
        const j = await r.json();
        out[p.id] = j.data ?? [];
      }));
      return out;
    },
    enabled: projectsWithFindings.length > 0,
  });

  const all = findingsByProject.data ?? {};
  const totalFindings = Object.values(all).flat().length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Security Findings</h1>
        <p className="text-xs text-muted-foreground">Aggregated findings from all scanners across all projects. {totalFindings} total.</p>
      </div>
      {projectsWithFindings.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><Bug className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" /><div className="text-xs font-mono text-muted-foreground">NO FINDINGS FROM CONFIGURED CHECKS</div><div className="text-[10px] text-muted-foreground mt-1">Run scanners from the project detail to populate this view.</div></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {projectsWithFindings.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="py-2.5">
                <div className="text-xs font-mono font-medium mb-1.5">{p.name} · {(all[p.id] ?? []).length} findings</div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {(all[p.id] ?? []).map((f: any) => (
                      <div key={f.id} className="border-l-2 border-border pl-2 py-1 text-xs">
                        <div className="flex items-center gap-2 mb-0.5">
                          <SeverityPill severity={f.severity} />
                          <Badge variant="outline" className="text-[10px] font-mono">{f.scanner}</Badge>
                          <span className="font-mono font-medium">{f.title}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{f.description}</div>
                        <div className="text-[10px] text-muted-foreground/70 font-mono">{f.evidence}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
