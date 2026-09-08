// Logs — aggregated logs across all projects. Pick a project to filter.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal } from 'lucide-react';

export function LogsView() {
  const [projectId, setProjectId] = useState<string>('');
  const projects = useQuery({
    queryKey: ['projects-all'],
    queryFn: async () => { const r = await fetch('/api/projects?limit=500'); const j = await r.json(); return j.data ?? []; },
  });
  const logs = useQuery({
    queryKey: ['logs', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const r = await fetch(`/api/projects/${projectId}/logs?limit=500`);
      const j = await r.json();
      return j.data ?? [];
    },
    enabled: !!projectId,
    refetchInterval: 2000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Logs</h1>
        <p className="text-xs text-muted-foreground">Per-project stdout/stderr capture. Refreshes every 2s.</p>
      </div>
      <div className="flex gap-2">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="text-xs w-72"><SelectValue placeholder="Select a project…" /></SelectTrigger>
          <SelectContent>
            {(projects.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="py-2">
          {!projectId ? (
            <div className="py-8 text-center"><Terminal className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" /><div className="text-xs font-mono text-muted-foreground">SELECT A PROJECT</div></div>
          ) : (logs.data ?? []).length === 0 ? (
            <div className="py-8 text-center"><div className="text-xs font-mono text-muted-foreground">NO LOG LINES</div></div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="font-mono text-[11px] leading-tight">
                {(logs.data ?? []).map((l: any) => (
                  <div key={l.id} className="flex gap-2 hover:bg-muted/20 px-1">
                    <span className="text-muted-foreground/60 shrink-0">{new Date(l.ts).toISOString().slice(11,19)}</span>
                    <span className={`shrink-0 ${l.stream === 'stderr' ? 'text-red-400' : l.stream === 'event' ? 'text-amber-400' : 'text-blue-400'}`}>{l.stream}</span>
                    <span className="whitespace-pre-wrap break-all">{l.line}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
