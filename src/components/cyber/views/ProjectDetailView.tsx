// Project Detail — tabbed view with all per-project information.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app';
import { useProcWs } from '@/hooks/useProcWs';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RotateCcw, Stethoscope, FileSearch, FileText, ScanLine, Loader2, Terminal, AlertTriangle, Bug } from 'lucide-react';
import { StatusPill, HealthPill, VerificationPill, SeverityPill, FreshnessPill, SourceLabelPill } from '../pills';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

export function ProjectDetailView() {
  const id = useAppStore((s) => s.activeProjectId);
  const setView = useAppStore((s) => s.setView);
  const qc = useQueryClient();

  const project = useQuery({
    queryKey: ['project', id],
    queryFn: async () => { const r = await fetch(`/api/projects/${id}`); const j = await r.json(); return j.data; },
    enabled: !!id,
    refetchInterval: 5000,
  });

  if (!id) return <div className="text-xs text-muted-foreground">No project selected.</div>;
  if (project.isLoading) return <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>;
  if (!project.data) return <div className="text-xs text-muted-foreground">Project not found.</div>;

  const p = project.data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => setView('projects')} className="text-[11px] text-muted-foreground hover:text-foreground">← Back to projects</button>
          <h1 className="text-xl font-semibold tracking-tight font-mono">{p.name}</h1>
          <p className="text-xs text-muted-foreground">{p.description ?? 'No description'}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <StatusPill status={p.status} />
            <HealthPill health={p.health} />
            <VerificationPill status={p.verificationStatus} />
            {p.ports?.map((port: number) => <Badge key={port} variant="outline" className="text-[10px] font-mono">:{port}</Badge>)}
          </div>
        </div>
        <ProjectActions projectId={p.id} />
      </div>

      <Card>
        <CardContent className="text-xs py-3 font-mono">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            <KV k="localPath" v={p.localPath} />
            <KV k="language" v={p.language} />
            <KV k="framework" v={p.framework} />
            <KV k="packageManager" v={p.packageManager} />
            <KV k="entryPoint" v={p.entryPoint} />
            <KV k="runCommand" v={p.runCommand} />
            <KV k="readmePath" v={p.readmePath} />
            <KV k="tags" v={(p.tags ?? []).join(', ')} />
            <KV k="lastVerificationAt" v={fmt(p.lastVerificationAt)} />
            <KV k="lastRunAt" v={fmt(p.lastRunAt)} />
            <KV k="lastSuccessfulRunAt" v={fmt(p.lastSuccessfulRunAt)} />
            <KV k="lastFailureAt" v={fmt(p.lastFailureAt)} />
            {p.lastFailureReason && <KV k="lastFailureReason" v={p.lastFailureReason} red />}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="text-xs">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="discovery" className="text-xs">Discovery</TabsTrigger>
          <TabsTrigger value="readme" className="text-xs">README</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
          <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
          <TabsTrigger value="scans" className="text-xs">Scans</TabsTrigger>
          <TabsTrigger value="findings" className="text-xs">Findings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab projectId={p.id} /></TabsContent>
        <TabsContent value="discovery"><DiscoveryTab projectId={p.id} /></TabsContent>
        <TabsContent value="readme"><ReadmeTab projectId={p.id} /></TabsContent>
        <TabsContent value="logs"><LogsTab projectId={p.id} /></TabsContent>
        <TabsContent value="health"><HealthTab projectId={p.id} /></TabsContent>
        <TabsContent value="scans"><ScansTab projectId={p.id} /></TabsContent>
        <TabsContent value="findings"><FindingsTab projectId={p.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectActions({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [working, setWorking] = useState<string | null>(null);

  async function call(action: string) {
    setWorking(action);
    try {
      const r = await fetch(`/api/projects/${projectId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: action === 'run' ? JSON.stringify({ action: 'dev' }) : '{}' });
      const j = await r.json();
      if (j.ok) {
        if (action === 'run') toast.success(`Started (pid ${j.data.pid ?? 'dry-run'})`);
        else toast.success(action.toUpperCase());
      } else {
        toast.error(j.error?.message ?? 'Action failed');
      }
    } catch (e) { toast.error((e as Error).message); }
    qc.invalidateQueries({ queryKey: ['project', projectId] });
    setWorking(null);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => call('run')} disabled={working === 'run'}>{working === 'run' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />} Run</Button>
      <Button size="sm" variant="outline" onClick={() => call('stop')} disabled={working === 'stop'}>{working === 'stop' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1.5" />} Stop</Button>
      <Button size="sm" variant="outline" onClick={() => call('restart')} disabled={working === 'restart'}>{working === 'restart' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />} Restart</Button>
      <Button size="sm" variant="outline" onClick={() => call('verify')} disabled={working === 'verify'}>{working === 'verify' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5 mr-1.5" />} Verify</Button>
      <Button size="sm" variant="outline" onClick={() => call('health')} disabled={working === 'health'}>{working === 'health' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5 mr-1.5" />} Health</Button>
      <Button size="sm" variant="outline" onClick={() => call('discover')} disabled={working === 'discover'}>{working === 'discover' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5 mr-1.5" />} Discover</Button>
      <Button size="sm" variant="outline" onClick={() => call('readme')} disabled={working === 'readme'}>{working === 'readme' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />} README</Button>
    </div>
  );
}

function OverviewTab({ projectId }: { projectId: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Project overview</CardTitle><CardDescription className="text-xs">Quick summary. Use the other tabs for detailed information.</CardDescription></CardHeader>
      <CardContent className="text-xs">
        <p className="text-muted-foreground">Use <b>Discover</b> to refresh technology detection, <b>README</b> to re-analyse the README, <b>Scans</b> to run scanners, and <b>Logs</b> to view real-time stdout/stderr.</p>
      </CardContent>
    </Card>
  );
}

function DiscoveryTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [working, setWorking] = useState(false);
  const snapshot = useQuery({
    queryKey: ['discovery', projectId],
    queryFn: async () => { const r = await fetch(`/api/projects/${projectId}/discover`, { method: 'POST' }); const j = await r.json(); return j.data?.snapshot; },
    enabled: false,
  });
  // We don't auto-fetch — the snapshot is the most recent one from the project row.
  // Provide a button to re-discover.
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileSearch className="h-4 w-4" /> Discovery snapshot</CardTitle></CardHeader>
      <CardContent className="text-xs space-y-2">
        {snapshot.data ? (
          <pre className="text-[11px] font-mono bg-muted/30 rounded p-3 overflow-x-auto">{JSON.stringify(snapshot.data, null, 2)}</pre>
        ) : (
          <div className="text-muted-foreground">Click <b>Discover</b> in the action bar to (re)analyse the project files.</div>
        )}
      </CardContent>
    </Card>
  );
}

function ReadmeTab({ projectId }: { projectId: string }) {
  const readme = useQuery({
    queryKey: ['readme', projectId],
    queryFn: async () => { const r = await fetch(`/api/projects/${projectId}/readme`, { method: 'POST' }); const j = await r.json(); return j.data; },
  });
  if (readme.isLoading) return <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Analysing README…</div>;
  if (!readme.data) return <div className="text-xs text-muted-foreground">No README analysis available.</div>;
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Commands extracted from README</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-2">
          {(readme.data.commands ?? []).map((c: any, i: number) => (
            <div key={i} className="border-l-2 border-border pl-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px] font-mono">{c.kind}</Badge>
                <Badge variant="outline" className={`text-[10px] font-mono ${c.confidence === 'HIGH' ? 'text-emerald-400' : c.confidence === 'LOW' ? 'text-red-400' : 'text-amber-400'}`}>{c.confidence}</Badge>
                {c.verified ? <Badge variant="outline" className="text-[10px] font-mono text-emerald-400">verified</Badge> : <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">unverified</Badge>}
                {c.source === 'ai' && <SourceLabelPill label="AI_INTERPRETATION" />}
              </div>
              <pre className="text-[11px] font-mono bg-muted/30 rounded px-2 py-1">{c.command}</pre>
              <div className="text-[10px] text-muted-foreground mt-1">Evidence: {c.evidence.join(', ')}</div>
              {c.conflict && <div className="text-[10px] text-amber-400 mt-1">⚠ {c.conflict}</div>}
            </div>
          ))}
          {(readme.data.commands ?? []).length === 0 && <div className="text-muted-foreground">No commands found in README.</div>}
        </CardContent>
      </Card>
      {readme.data.rendered && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">README content</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <pre className="text-[11px] font-mono whitespace-pre-wrap">{readme.data.rendered}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LogsTab({ projectId }: { projectId: string }) {
  const ws = useProcWs(projectId);
  const logs = useQuery({
    queryKey: ['logs', projectId],
    queryFn: async () => { const r = await fetch(`/api/projects/${projectId}/logs?limit=500`); const j = await r.json(); return j.data ?? []; },
    refetchInterval: 2000,
  });
  const allLines: { ts: string; stream: string; line: string }[] = [
    ...(logs.data ?? []).map((l: any) => ({ ts: l.ts, stream: l.stream, line: l.line })),
    ...ws.events.filter((e) => e.type === 'log' && e.line).map((e) => ({ ts: e.ts, stream: e.stream ?? 'event', line: e.line ?? '' })),
  ].slice(-1000);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between"><span className="flex items-center gap-2"><Terminal className="h-4 w-4" /> Logs (live via WebSocket)</span> <span className="text-[10px] font-mono">{ws.connected ? <span className="text-emerald-400">● WS CONNECTED</span> : <span className="text-red-400">○ WS DISCONNECTED</span>}</span></CardTitle></CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[60vh]">
          <div className="font-mono text-[11px] leading-tight space-y-0">
            {allLines.length === 0 ? <div className="text-muted-foreground">No logs yet. Run the project to see stdout/stderr in real time.</div> : allLines.map((l, i) => (
              <div key={i} className="flex gap-2 hover:bg-muted/20 px-1">
                <span className="text-muted-foreground/60 shrink-0">{new Date(l.ts).toISOString().slice(11,19)}</span>
                <span className={`shrink-0 ${l.stream === 'stderr' ? 'text-red-400' : l.stream === 'event' ? 'text-amber-400' : 'text-blue-400'}`}>{l.stream}</span>
                <span className="whitespace-pre-wrap break-all">{l.line}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function HealthTab({ projectId }: { projectId: string }) {
  const health = useQuery({
    queryKey: ['health', projectId],
    queryFn: async () => { const r = await fetch(`/api/projects/${projectId}/health`); const j = await r.json(); return j.data; },
    refetchInterval: 5000,
  });
  if (health.isLoading) return <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Probing…</div>;
  const h = health.data;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Health probe</CardTitle></CardHeader>
      <CardContent className="text-xs space-y-2">
        {h && (
          <>
            <KV k="process" v={h.process} />
            <KV k="health" v={h.health} />
            {h.ports?.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-2">Ports</div>
                {h.ports.map((p: any) => (
                  <div key={p.port} className="flex items-center gap-2"><span className="font-mono">:{p.port}</span> <span className={p.status === 'open' ? 'text-emerald-400' : 'text-muted-foreground'}>{p.status}</span></div>
                ))}
              </div>
            )}
            {h.http && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-2">HTTP probe</div>
                <KV k="endpoint" v={h.http.endpoint} />
                <KV k="ok" v={String(h.http.ok)} />
                {h.http.statusCode && <KV k="statusCode" v={String(h.http.statusCode)} />}
                {h.http.reason && <KV k="reason" v={h.http.reason} red />}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ScansTab({ projectId }: { projectId: string }) {
  const scans = useQuery({
    queryKey: ['scans', projectId],
    queryFn: async () => { const r = await fetch(`/api/projects/${projectId}/scans`); const j = await r.json(); return j.data ?? []; },
    refetchInterval: 5000,
  });
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>(['dependency', 'secret', 'config']);
  const [running, setRunning] = useState(false);
  const all: any[] = scans.data ?? [];

  async function run() {
    setRunning(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanners: selected }),
      });
      const j = await r.json();
      if (j.ok) toast.success(`Scan complete: ${j.data.summaries?.length} scanners ran`);
      else toast.error(j.error?.message ?? 'Scan failed');
      qc.invalidateQueries({ queryKey: ['scans', projectId] });
      qc.invalidateQueries({ queryKey: ['findings', projectId] });
    } finally { setRunning(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ScanLine className="h-4 w-4" /> Scans</CardTitle></CardHeader>
      <CardContent className="text-xs space-y-3">
        <div className="flex flex-wrap gap-4 items-center">
          {['dependency', 'secret', 'config'].map((s) => (
            <label key={s} className="flex items-center gap-2 text-xs">
              <Checkbox checked={selected.includes(s)} onCheckedChange={(c) => setSelected((prev) => c ? [...prev, s] : prev.filter((x) => x !== s))} />
              <span className="font-mono">{s}</span>
            </label>
          ))}
          <Button size="sm" onClick={run} disabled={running || selected.length === 0}>{running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5 mr-1.5" />} Run scan</Button>
        </div>
        {all.length === 0 ? <div className="text-muted-foreground">No scans run yet.</div> : (
          <div className="space-y-1">
            {all.map((s) => (
              <div key={s.id} className="border-l-2 border-border pl-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">{s.scanner}</Badge>
                  <span className={s.status === 'completed' ? 'text-emerald-400 text-[10px] font-mono' : s.status === 'failed' ? 'text-red-400 text-[10px] font-mono' : 'text-amber-400 text-[10px] font-mono'}>{s.status}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{s.findingCount} findings</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{fmt(s.startedAt)} → {fmt(s.endedAt) ?? 'running'}</span>
                </div>
                {s.summary && <pre className="text-[10px] font-mono mt-1 bg-muted/30 rounded p-1.5 overflow-x-auto">{JSON.stringify(s.summary, null, 2)}</pre>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FindingsTab({ projectId }: { projectId: string }) {
  const findings = useQuery({
    queryKey: ['findings', projectId],
    queryFn: async () => { const r = await fetch(`/api/projects/${projectId}/findings?limit=500`); const j = await r.json(); return j.data ?? []; },
  });
  const all: any[] = findings.data ?? [];
  if (all.length === 0) return (
    <Card>
      <CardContent className="py-8 text-center">
        <Bug className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
        <div className="text-xs font-mono text-muted-foreground">NO FINDINGS FROM CONFIGURED CHECKS</div>
        <div className="text-[10px] text-muted-foreground mt-1">Run a scan from the Scans tab.</div>
      </CardContent>
    </Card>
  );
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bug className="h-4 w-4" /> Findings ({all.length})</CardTitle></CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-1.5">
            {all.map((f) => (
              <div key={f.id} className="border-l-2 border-border pl-2 py-1 text-xs">
                <div className="flex items-center gap-2 mb-0.5">
                  <SeverityPill severity={f.severity} />
                  <Badge variant="outline" className="text-[10px] font-mono">{f.scanner}</Badge>
                  <span className="font-mono font-medium">{f.title}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{f.description}</div>
                <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{f.evidence}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function KV({ k, v, red }: { k: string; v: string | null | undefined; red?: boolean }) {
  return (
    <div className="flex items-start gap-2 border-b border-border/30 py-0.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-44 shrink-0">{k}</span>
      <span className={`font-mono break-all ${red ? 'text-red-400' : ''}`}>{v || '—'}</span>
    </div>
  );
}

function fmt(s: string | null | undefined) {
  if (!s) return null;
  try { return new Date(s).toISOString().slice(0,19).replace("T"," ") + "Z"; } catch { return s; }
}
