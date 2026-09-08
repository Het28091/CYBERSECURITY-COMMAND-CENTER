// Projects — registry of all registered projects with filter + search.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Search } from 'lucide-react';
import { StatusPill, HealthPill, VerificationPill } from '../pills';

export function ProjectsView() {
  const openProject = useAppStore((s) => s.openProject);
  const setView = useAppStore((s) => s.setView);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('any');
  const [category, setCategory] = useState<string>('');

  const projects = useQuery({
    queryKey: ['projects-all', q, status, category],
    queryFn: async () => {
      const url = new URL('/api/projects', location.origin);
      if (q) url.searchParams.set('q', q);
      if (status && status !== 'any') url.searchParams.set('status', status);
      if (category) url.searchParams.set('category', category);
      const r = await fetch(url.toString());
      const j = await r.json();
      return j.data ?? [];
    },
    refetchInterval: 10000,
  });

  const allProjects: any[] = projects.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-xs text-muted-foreground">All locally registered cybersecurity projects. {allProjects.length} found.</p>
        </div>
        <Button size="sm" onClick={() => setView('add-project')}><PlusCircle className="h-3.5 w-3.5 mr-2" /> Add Project</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="pl-8 text-xs" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] text-xs"><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            <SelectItem value="REGISTERED">REGISTERED</SelectItem>
            <SelectItem value="DISCOVERED">DISCOVERED</SelectItem>
            <SelectItem value="VERIFIED">VERIFIED</SelectItem>
            <SelectItem value="RUNNING">RUNNING</SelectItem>
            <SelectItem value="STOPPED">STOPPED</SelectItem>
            <SelectItem value="FAILED">FAILED</SelectItem>
          </SelectContent>
        </Select>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category…" className="w-[140px] text-xs" />
      </div>

      {allProjects.length === 0 ? (
        <div className="border border-dashed rounded p-8 text-center">
          <div className="text-xs font-mono text-muted-foreground">NO PROJECTS REGISTERED</div>
          <div className="text-xs text-muted-foreground mt-1">Click "Add Project" to register your first local project.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allProjects.map((p) => (
            <button key={p.id} onClick={() => openProject(p.id)} className="text-left border bg-card hover:bg-accent/40 transition-colors rounded-lg p-3 flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-mono font-medium truncate">{p.name}</span>
                <StatusPill status={p.status} />
              </div>
              {p.description && <div className="text-[11px] text-muted-foreground line-clamp-2">{p.description}</div>}
              <div className="flex flex-wrap gap-1 text-[10px] font-mono text-muted-foreground">
                {p.language && <span className="px-1.5 py-0.5 rounded bg-muted/50">{p.language}</span>}
                {p.framework && p.framework !== 'UNKNOWN' && <span className="px-1.5 py-0.5 rounded bg-muted/50">{p.framework}</span>}
                {p.packageManager && p.packageManager !== 'UNKNOWN' && <span className="px-1.5 py-0.5 rounded bg-muted/50">{p.packageManager}</span>}
                {p.ports?.length > 0 && p.ports.map((port: number) => <span key={port} className="px-1.5 py-0.5 rounded bg-muted/50">:{port}</span>)}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground truncate">{p.localPath}</div>
              <div className="flex items-center gap-2 mt-1">
                <HealthPill health={p.health} />
                <VerificationPill status={p.verificationStatus} />
              </div>
              {p.findingCount > 0 && <div className="text-[10px] text-red-400 font-mono">{p.findingCount} findings</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
