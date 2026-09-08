// Automation — placeholder view that explains the scanner + agent
// automation capabilities and exposes the scanner catalogue.

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Workflow, Loader2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function AutomationView() {
  const scanners = useQuery({
    queryKey: ['scanners'],
    queryFn: async () => { const r = await fetch('/api/scanners'); const j = await r.json(); return j.data ?? []; },
  });
  const all: any[] = scanners.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Automation</h1>
        <p className="text-xs text-muted-foreground">Available scanners and agent-orchestrated workflows you can trigger on registered projects.</p>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Workflow className="h-4 w-4" /> Scanner catalogue</CardTitle><CardDescription className="text-xs">Available scanners. Trigger from the project detail view.</CardDescription></CardHeader>
        <CardContent>
          {scanners.isLoading ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div> : (
            <div className="space-y-1.5">
              {all.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-l-2 border-border pl-2 py-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px] font-mono">{s.category}</Badge>
                  <span className="font-mono font-medium">{s.name}</span>
                  <span className="text-muted-foreground flex-1">{s.description}</span>
                  {s.supported ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Badge variant="outline" className="text-[10px] font-mono text-red-400 border-red-500/40">UNSUPPORTED</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
