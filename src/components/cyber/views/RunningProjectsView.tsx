// Running Projects — live view of all running processes with stop/restart actions.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Square, RotateCcw, Stethoscope, Terminal } from 'lucide-react';
import { StatusPill, HealthPill } from '../pills';
import { toast } from 'sonner';

export function RunningProjectsView() {
  const openProject = useAppStore((s) => s.openProject);
  const setView = useAppStore((s) => s.setView);
  const qc = useQueryClient();

  const projects = useQuery({
    queryKey: ['projects-running'],
    queryFn: async () => {
      const r = await fetch('/api/projects?limit=500');
      const j = await r.json();
      return (j.data ?? []).filter((p: any) => p.status === 'RUNNING' || p.status === 'STARTED' || p.status === 'STARTING' || p.status === 'STOPPING');
    },
    refetchInterval: 3000,
  });

  const running: any[] = projects.data ?? [];

  async function stop(id: string) {
    try {
      const r = await fetch(`/api/projects/${id}/stop`, { method: 'POST' });
      const j = await r.json();
      if (j.ok) toast.success('Stop requested');
      else toast.error(j.error?.message ?? 'Stop failed');
    } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries({ queryKey: ['projects-running'] });
  }

  async function restart(id: string) {
    try {
      const r = await fetch(`/api/projects/${id}/restart`, { method: 'POST' });
      const j = await r.json();
      if (j.ok) toast.success('Restart started');
      else toast.error(j.error?.message ?? 'Restart failed');
    } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries({ queryKey: ['projects-running'] });
  }

  async function health(id: string) {
    try {
      const r = await fetch(`/api/projects/${id}/health`);
      const j = await r.json();
      if (j.ok) toast.message(`Health: ${j.data.health}`);
    } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries({ queryKey: ['projects-running'] });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Running Projects</h1>
        <p className="text-xs text-muted-foreground">Live processes tracked by the process manager. Updates every 3s.</p>
      </div>

      {running.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Activity className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <div className="text-xs font-mono text-muted-foreground">NO PROJECTS RUNNING</div>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setView('projects')}>Browse projects</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {running.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <button className="text-left font-mono font-medium truncate" onClick={() => openProject(p.id)}>{p.name}</button>
                  <span className="flex items-center gap-2">
                    <StatusPill status={p.status} />
                    <HealthPill health={p.health} />
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-[11px] font-mono text-muted-foreground truncate">{p.localPath}</div>
                {p.runCommand && <div className="text-[11px] font-mono bg-muted/30 rounded px-2 py-1 truncate">$ {p.runCommand}</div>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" onClick={() => stop(p.id)}><Square className="h-3.5 w-3.5 mr-1.5" /> Stop</Button>
                  <Button size="sm" variant="outline" onClick={() => restart(p.id)}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restart</Button>
                  <Button size="sm" variant="outline" onClick={() => health(p.id)}><Stethoscope className="h-3.5 w-3.5 mr-1.5" /> Health</Button>
                  <Button size="sm" variant="outline" onClick={() => openProject(p.id)}><Terminal className="h-3.5 w-3.5 mr-1.5" /> Logs</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
