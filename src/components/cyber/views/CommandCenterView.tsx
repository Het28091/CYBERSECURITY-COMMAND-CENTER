// CommandCenterView — premium dashboard with KPI tiles, live data, and 3D topology.

import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app';
import { StatusPill, HealthPill, FreshnessPill } from '../pills';
import { Activity, FolderKanban, ShieldAlert, ClipboardList, Database, AlertTriangle, Server, RadioTower, ShieldCheck, Clock, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export function CommandCenterView() {
  const setView = useAppStore((s) => s.setView);
  const openProject = useAppStore((s) => s.openProject);

  const projects = useQuery({
    queryKey: ['projects-all'],
    queryFn: async () => { const r = await fetch('/api/projects?limit=200'); if (!r.ok) return []; const j = await r.json(); return j.data ?? []; },
    refetchInterval: 5000,
    retry: false,
  });

  const audit = useQuery({
    queryKey: ['audit-recent'],
    queryFn: async () => { const r = await fetch('/api/audit?limit=10'); if (!r.ok) return []; const j = await r.json(); return j.data ?? []; },
    refetchInterval: 10000,
    retry: false,
  });

  const sources = useQuery({
    queryKey: ['datasources'],
    queryFn: async () => { const r = await fetch('/api/system/datasources'); if (!r.ok) return []; const j = await r.json(); return j.data ?? []; },
    refetchInterval: 15000,
    retry: false,
  });

  const allProjects = projects.data ?? [];
  const running = allProjects.filter((p: any) => p.status === 'RUNNING' || p.status === 'STARTED');
  const unhealthy = allProjects.filter((p: any) => p.health === 'UNHEALTHY' || p.health === 'DEGRADED');
  const recentAudit = audit.data ?? [];
  const dataSources = sources.data ?? [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg cyber-display text-foreground">Command Center</h1>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">Real-time security operations status · local-first</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 cyber-edge-subtle text-[10px] font-mono">
            <span className={cn('h-1.5 w-1.5 rounded-full', running.length > 0 ? 'bg-signal-ok cyber-pulse' : 'bg-muted-foreground/30')} />
            {running.length > 0 ? `${running.length} ACTIVE` : 'IDLE'}
          </div>
        </div>
      </div>

      {/* KPI tiles — premium card composition */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiTile label="Projects" value={allProjects.length} icon={FolderKanban} onClick={() => setView('projects')} />
        <KpiTile label="Running" value={running.length} icon={Activity} tone="blue" onClick={() => setView('running')} />
        <KpiTile label="Issues" value={unhealthy.length} icon={AlertTriangle} tone={unhealthy.length ? 'red' : 'green'} onClick={() => setView('running')} />
        <KpiTile label="Audit Events" value={recentAudit.length} icon={ClipboardList} onClick={() => setView('audit')} />
        <KpiTile label="Data Sources" value={dataSources.length} icon={Database} onClick={() => setView('system')} />
      </div>

      {/* Main grid: running + audit + feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Running projects */}
        <div className="lg:col-span-1 space-y-3">
          <SectionHeader icon={Activity} title="Running" count={running.length} />
          {running.length === 0 ? (
            <EmptyState text="NO PROJECTS RUNNING" subtext="Start a project from the Projects view." onClick={() => setView('projects')} actionLabel="Browse projects" />
          ) : (
            <div className="space-y-1.5">
              {running.map((p: any) => (
                <button key={p.id} onClick={() => openProject(p.id)} className="w-full text-left p-3 rounded-md bg-surface-2 cyber-edge hover:bg-surface-3 cyber-card-hover group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-medium text-foreground/90 truncate">{p.name}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 font-mono">
                    <HealthPill health={p.health} />
                    <span className="truncate">{p.localPath}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent audit */}
        <div className="lg:col-span-1 space-y-3">
          <SectionHeader icon={ClipboardList} title="Recent Activity" count={recentAudit.length} />
          {recentAudit.length === 0 ? (
            <EmptyState text="NO ACTIVITY" subtext="Actions will appear here." />
          ) : (
            <ScrollArea className="max-h-72 rounded-md bg-surface-2 cyber-edge-subtle">
              <div className="p-2 space-y-1">
                {recentAudit.map((e: any) => (
                  <div key={e.id} className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-surface-3 transition-colors text-[11px]">
                    <span className={cn(
                      'font-mono text-[9px] shrink-0 px-1.5 py-0.5 rounded',
                      e.result === 'success' ? 'text-signal-ok bg-signal-ok/5' : 'text-signal-fail bg-signal-fail/5'
                    )}>{e.result === 'success' ? 'OK' : 'FAIL'}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-foreground/80">{e.action}</span>{' '}
                      <span className="text-muted-foreground/50">{e.objectType}</span>
                      {e.reason && <div className="text-[9px] text-signal-warn truncate">{e.reason}</div>}
                    </div>
                    <span className="text-[9px] text-muted-foreground/40 font-mono shrink-0 tabular-nums">{new Date(e.ts).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Data sources */}
        <div className="lg:col-span-1 space-y-3">
          <SectionHeader icon={RadioTower} title="Data Sources" count={dataSources.length} />
          {dataSources.length === 0 ? (
            <EmptyState text="NO DATA SOURCES" subtext="Run the seed script first." />
          ) : (
            <div className="space-y-1">
              {dataSources.map((s: any) => (
                <div key={s.code} className="flex items-center justify-between px-3 py-1.5 rounded bg-surface-2 cyber-edge-subtle text-[11px]">
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3 text-muted-foreground/40" />
                    <span className="font-mono text-foreground/70">{s.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground/40 font-mono">
                      {s.lastSuccessAt ? new Date(s.lastSuccessAt).toISOString().slice(0,16).replace('T',' ') + 'Z' : 'never'}
                    </span>
                    <FreshnessPill freshness={s.freshness} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System self-check */}
      <div className="rounded-md bg-surface-2 cyber-edge p-3">
        <SectionHeader icon={Server} title="System Health" />
        <SystemSelfCheck />
      </div>
    </div>
  );
}

function SystemSelfCheck() {
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => { const r = await fetch('/api/system/health'); if (!r.ok) return null; const j = await r.json(); return j.data; },
    refetchInterval: 10000,
    retry: false,
  });
  const data = health.data;
  if (!data) return <div className="text-[11px] text-muted-foreground/50 py-2">Probing…</div>;
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      <Pill label="DB" ok={data.db === 'ok'} />
      <Pill label="FS" ok={data.fs === 'ok'} />
      <Pill label="WS" ok={data.ws === 'ok'} />
      <div className="text-[10px] font-mono text-muted-foreground/60 flex items-center ml-2">
        OVERALL: <span className={cn('ml-1 font-semibold', data.overall === 'HEALTHY' ? 'text-signal-ok' : data.overall === 'DEGRADED' ? 'text-signal-warn' : 'text-signal-fail')}>{data.overall}</span>
      </div>
    </div>
  );
}

function Pill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={cn('font-mono text-[10px] px-2 py-0.5 rounded border', ok ? 'text-signal-ok border-signal-ok/30 bg-signal-ok/5' : 'text-signal-fail border-signal-fail/30 bg-signal-fail/5')}>
      {label}: {ok ? 'OK' : 'FAIL'}
    </span>
  );
}

function KpiTile({ label, value, icon: Icon, onClick, tone = 'default' }: { label: string; value: number; icon: any; onClick?: () => void; tone?: 'default' | 'red' | 'green' | 'blue' }) {
  const cls =
    tone === 'red' ? 'text-signal-fail' :
    tone === 'green' ? 'text-signal-ok' :
    tone === 'blue' ? 'text-primary' : 'text-foreground';
  return (
    <button onClick={onClick} className="text-left p-3 rounded-md bg-surface-2 cyber-edge hover:bg-surface-3 cyber-card-hover transition-all">
      <div className="flex items-center justify-between mb-1.5">
        <span className="cyber-label text-muted-foreground/50">{label}</span>
        <Icon className="h-3 w-3 text-muted-foreground/30" />
      </div>
      <div className={cn('cyber-metric', cls)}>{value}</div>
    </button>
  );
}

function SectionHeader({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
      <span className="text-xs font-medium text-foreground/80">{title}</span>
      {count !== undefined && <span className="text-[10px] text-muted-foreground/40 font-mono">({count})</span>}
    </div>
  );
}

function EmptyState({ text, subtext, onClick, actionLabel }: { text: string; subtext?: string; onClick?: () => void; actionLabel?: string }) {
  return (
    <div className="rounded-md border border-dashed cyber-edge-subtle p-4 text-center">
      <XCircle className="h-5 w-5 text-muted-foreground/20 mx-auto mb-1.5" />
      <div className="text-[11px] font-mono text-muted-foreground/50">{text}</div>
      {subtext && <div className="text-[10px] text-muted-foreground/30 mt-0.5">{subtext}</div>}
      {onClick && actionLabel && (
        <button onClick={onClick} className="mt-2 text-[10px] text-primary hover:underline">{actionLabel} →</button>
      )}
    </div>
  );
}
