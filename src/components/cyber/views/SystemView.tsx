// System — health + data sources + data source refresh.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Server, Database, RefreshCw, HardDrive, Wifi } from 'lucide-react';
import { FreshnessPill } from '../pills';
import { toast } from 'sonner';

export function SystemView() {
  const qc = useQueryClient();
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => { const r = await fetch('/api/system/health'); const j = await r.json(); return j.data; },
    refetchInterval: 10000,
  });
  const sources = useQuery({
    queryKey: ['datasources'],
    queryFn: async () => { const r = await fetch('/api/system/datasources'); const j = await r.json(); return j.data ?? []; },
    refetchInterval: 15000,
  });

  async function refresh(code: string) {
    try {
      const r = await fetch(`/api/system/datasources/${code}/refresh`, { method: 'POST' });
      const j = await r.json();
      if (j.data?.ok) toast.success(`Refreshed: ${code}`);
      else toast.warning(`Refresh of ${code} reported: ${j.data?.reason ?? 'unknown'}`);
      qc.invalidateQueries({ queryKey: ['datasources'] });
    } catch (e) { toast.error((e as Error).message); }
  }

  const h = health.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">System</h1>
        <p className="text-xs text-muted-foreground">Health probes and external data source freshness.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" /> Application health</CardTitle><CardDescription className="text-xs">Probes every 10s.</CardDescription></CardHeader>
        <CardContent className="text-xs space-y-1.5">
          <ProbeRow icon={Database} label="Database (Prisma/SQLite)" ok={h?.db === 'ok'} detail={h?.db} />
          <ProbeRow icon={HardDrive} label="Filesystem" ok={h?.fs === 'ok'} detail={h?.fs} />
          <ProbeRow icon={Wifi} label="WebSocket mini-service (port 3003)" ok={h?.ws === 'ok'} detail={h?.ws} />
          <div className="mt-2 text-muted-foreground font-mono">OVERALL: <span className={h?.overall === 'HEALTHY' ? 'text-emerald-400' : h?.overall === 'DEGRADED' ? 'text-amber-400' : 'text-red-400'}>{h?.overall ?? 'PROBING'}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> External data sources</CardTitle><CardDescription className="text-xs">Tier-1 sources: OSV.dev, NVD, OWASP, EU regulatory portals.</CardDescription></CardHeader>
        <CardContent className="text-xs">
          {(sources.data ?? []).map((s: any) => (
            <div key={s.code} className="flex items-center justify-between border-b border-border/30 py-1.5">
              <div className="flex items-center gap-2"><span className="font-mono">{s.code}</span><span className="text-muted-foreground">·</span><span className="text-muted-foreground">{s.name}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/70 font-mono">{s.lastSuccessAt ? `ok ${new Date(s.lastSuccessAt).toISOString().slice(0,19).replace("T"," ") + "Z"}` : 'never ok'}</span>
                <FreshnessPill freshness={s.freshness} />
                <Button size="sm" variant="outline" onClick={() => refresh(s.code)}><RefreshCw className="h-3 w-3 mr-1.5" /> Refresh</Button>
              </div>
            </div>
          ))}
          {(sources.data ?? []).length === 0 && <div className="text-muted-foreground">No data sources registered.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function ProbeRow({ icon: Icon, label, ok, detail }: { icon: any; label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <span className={`font-mono ${ok ? 'text-emerald-400' : 'text-red-400'}`}>{detail ?? (ok ? 'ok' : 'fail')}</span>
    </div>
  );
}
