// Audit — list audit events with filters.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardList } from 'lucide-react';

export function AuditView() {
  const [action, setAction] = useState('');
  const [objectType, setObjectType] = useState('');
  const events = useQuery({
    queryKey: ['audit', action, objectType],
    queryFn: async () => {
      const url = new URL('/api/audit', location.origin);
      if (action) url.searchParams.set('action', action);
      if (objectType) url.searchParams.set('objectType', objectType);
      url.searchParams.set('limit', '500');
      const r = await fetch(url.toString()); const j = await r.json(); return j.data ?? [];
    },
    refetchInterval: 10000,
  });
  const all: any[] = events.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Audit Trail</h1>
        <p className="text-xs text-muted-foreground">Append-only record of every significant action. {all.length} events shown.</p>
      </div>
      <div className="flex gap-2">
        <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="action contains…" className="text-xs" />
        <Input value={objectType} onChange={(e) => setObjectType(e.target.value)} placeholder="objectType…" className="text-xs" />
      </div>
      <Card>
        <CardContent className="py-2">
          {all.length === 0 ? (
            <div className="py-8 text-center"><ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" /><div className="text-xs font-mono text-muted-foreground">NO AUDIT EVENTS</div></div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="text-[11px] font-mono">
                {all.map((e) => (
                  <div key={e.id} className="flex gap-2 border-b border-border/30 py-1 hover:bg-muted/20">
                    <span className="text-muted-foreground/70 shrink-0 w-32">{new Date(e.ts).toISOString().slice(0,19).replace("T"," ") + "Z"}</span>
                    <span className={`shrink-0 w-16 ${e.result === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{e.result.toUpperCase()}</span>
                    <span className="shrink-0 w-44">{e.action}</span>
                    <span className="shrink-0 w-32 text-muted-foreground">{e.objectType}</span>
                    <span className="text-muted-foreground/70 shrink-0 w-24">{e.objectId?.slice(-12) ?? '—'}</span>
                    <span className="flex-1 text-muted-foreground truncate">{e.reason ?? JSON.stringify(e.metadata ?? {}).slice(0, 80)}</span>
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
