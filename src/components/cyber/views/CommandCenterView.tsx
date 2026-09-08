// Command Center — main dashboard view. Real data, no fake telemetry.

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAppStore } from '@/stores/app';
import { StatusPill, HealthPill, FreshnessPill } from '../pills';
import { Activity, FolderKanban, ShieldAlert, ClipboardList, Database, AlertTriangle, Server, RadioTower } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CommandCenterView() {
  const setView = useAppStore((s) => s.setView);
  const openProject = useAppStore((s) => s.openProject);

  const projects = useQuery({
    queryKey: ['projects-all'],
    queryFn: async () => { const r = await fetch('/api/projects?limit=200'); const j = await r.json(); return j.data ?? []; },
    refetchInterval: 5000,
  });

  const audit = useQuery({
    queryKey: ['audit-recent'],
    queryFn: async () => { const r = await fetch('/api/audit?limit=10'); const j = await r.json(); return j.data ?? []; },
    refetchInterval: 10000,
  });

  const sources = useQuery({
    queryKey: ['datasources'],
    queryFn: async () => { const r = await fetch('/api/system/datasources'); const j = await r.json(); return j.data ?? []; },
    refetchInterval: 15000,
  });

  const allProjects = projects.data ?? [];
  const running = allProjects.filter((p: any) => p.status === 'RUNNING' || p.status === 'STARTED');
  const unhealthy = allProjects.filter((p: any) => p.health === 'UNHEALTHY' || p.health === 'DEGRADED');
  const recentAudit = audit.data ?? [];
  const dataSources = sources.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Command Center</h1>
        <p className="text-xs text-muted-foreground">Real-time status of the local cybersecurity workspace.</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile label="Projects registered" value={allProjects.length} icon={FolderKanban} onClick={() => setView('projects')} />
        <KpiTile label="Running now" value={running.length} icon={Activity} tone="blue" onClick={() => setView('running')} />
        <KpiTile label="Unhealthy" value={unhealthy.length} icon={AlertTriangle} tone={unhealthy.length ? 'red' : 'green'} onClick={() => setView('running')} />
        <KpiTile label="Audit events (recent)" value={recentAudit.length} icon={ClipboardList} onClick={() => setView('audit')} />
        <KpiTile label="Data sources" value={dataSources.length} icon={Database} onClick={() => setView('system')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Running projects */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> What is running</CardTitle>
            <CardDescription className="text-xs">Live status from the process manager. Updates every 5s.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {running.length === 0 ? (
              <EmptyState text="NO PROJECTS RUNNING" subtext="Start a project from the Projects view." />
            ) : (
              <div className="space-y-1.5">
                {running.map((p: any) => (
                  <button key={p.id} onClick={() => openProject(p.id)} className="w-full text-left text-xs border rounded px-3 py-2 hover:bg-muted/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium truncate">{p.name}</span>
                      <span className="flex items-center gap-2">
                        <StatusPill status={p.status} />
                        <HealthPill health={p.health} />
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{p.localPath}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent audit */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> What changed recently</CardTitle>
            <CardDescription className="text-xs">Last 10 audit events.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {recentAudit.length === 0 ? (
              <EmptyState text="NO AUDIT EVENTS" subtext="Significant actions will appear here." />
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-1">
                  {recentAudit.map((e: any) => (
                    <div key={e.id} className="text-xs flex items-start gap-2 border-b border-border/30 pb-1">
                      <span className={`font-mono text-[10px] shrink-0 px-1.5 py-0.5 rounded ${e.result === 'success' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>{e.result.toUpperCase()}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono">{e.action}</span>{' '}
                        <span className="text-muted-foreground">{e.objectType}{e.objectId ? `:${e.objectId.slice(-6)}` : ''}</span>
                        {e.reason && <div className="text-[10px] text-red-400 truncate">{e.reason}</div>}
                      </div>
                      <span className="text-[10px] text-muted-foreground/70 font-mono shrink-0">{new Date(e.ts).toISOString().slice(11,19)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Data source freshness */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><RadioTower className="h-4 w-4" /> External data sources</CardTitle>
            <CardDescription className="text-xs">Authoritative Tier-1 sources; OSV.dev + NVD for vulnerabilities.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {dataSources.length === 0 ? (
              <EmptyState text="NO DATA SOURCES" subtext="Run the seed script first." />
            ) : (
              <div className="space-y-1.5">
                {dataSources.map((s: any) => (
                  <div key={s.code} className="text-xs flex items-center justify-between border-b border-border/30 py-1">
                    <div className="flex items-center gap-2">
                      <Database className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">{s.code}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {s.lastSuccessAt ? `last ok ${new Date(s.lastSuccessAt).toISOString().slice(0,16).replace('T',' ')}Z` : 'never'}
                      </span>
                      <FreshnessPill freshness={s.freshness} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Highest-risk focus */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> What requires attention</CardTitle>
            <CardDescription className="text-xs">Projects with FAILED / UNHEALTHY status or recent failures.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {unhealthy.length === 0 && !allProjects.some((p: any) => p.lastFailureAt) ? (
              <EmptyState text="NO ISSUES DETECTED" subtext="No failed projects or recent failures." />
            ) : (
              <div className="space-y-1">
                {unhealthy.map((p: any) => (
                  <button key={p.id} onClick={() => openProject(p.id)} className="w-full text-left text-xs border rounded px-3 py-1.5 hover:bg-muted/50">
                    <span className="font-mono font-medium">{p.name}</span> <span className="text-muted-foreground">— {p.health}</span>
                  </button>
                ))}
                {allProjects.filter((p: any) => p.lastFailureAt).slice(0, 5).map((p: any) => (
                  <button key={p.id} onClick={() => openProject(p.id)} className="w-full text-left text-xs border rounded px-3 py-1.5 hover:bg-muted/50">
                    <span className="font-mono font-medium">{p.name}</span> <span className="text-muted-foreground">— failed at {new Date(p.lastFailureAt).toISOString().slice(0,19).replace("T"," ") + "Z"}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" /> Dashboard self-check</CardTitle>
          <CardDescription className="text-xs">The Command Center probes its own dependencies every 10s.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <SystemSelfCheck />
        </CardContent>
      </Card>
    </div>
  );
}

function SystemSelfCheck() {
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => { const r = await fetch('/api/system/health'); const j = await r.json(); return j.data; },
    refetchInterval: 10000,
  });
  const data = health.data;
  if (!data) return <div className="text-xs text-muted-foreground">Probing…</div>;
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <Pill label="DB"  ok={data.db === 'ok'} />
      <Pill label="FS"  ok={data.fs === 'ok'} />
      <Pill label="WS"  ok={data.ws === 'ok'} />
      <div className="text-muted-foreground font-mono">OVERALL: <span className={data.overall === 'HEALTHY' ? 'text-emerald-400' : data.overall === 'DEGRADED' ? 'text-amber-400' : 'text-red-400'}>{data.overall}</span></div>
    </div>
  );
}

function Pill({ label, ok }: { label: string; ok: boolean }) {
  return <span className={`font-mono px-2 py-0.5 border rounded ${ok ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-red-400 border-red-500/40 bg-red-500/10'}`}>{label}: {ok ? 'ok' : 'fail'}</span>;
}

function KpiTile({ label, value, icon: Icon, onClick, tone = 'default' }: { label: string; value: number; icon: any; onClick?: () => void; tone?: 'default' | 'red' | 'green' | 'blue' }) {
  const cls =
    tone === 'red' ? 'text-red-400' :
    tone === 'green' ? 'text-emerald-400' :
    tone === 'blue' ? 'text-blue-400' : 'text-foreground';
  return (
    <button onClick={onClick} className="text-left border bg-card hover:bg-accent/40 transition-colors rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
    </button>
  );
}

function EmptyState({ text, subtext }: { text: string; subtext?: string }) {
  return (
    <div className="border border-dashed rounded p-4 text-center">
      <div className="text-xs font-mono text-muted-foreground">{text}</div>
      {subtext && <div className="text-[10px] text-muted-foreground/60 mt-1">{subtext}</div>}
    </div>
  );
}
