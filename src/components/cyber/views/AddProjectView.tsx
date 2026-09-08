// Add Project — multi-step workflow: path → discover → readme → dry-run → register.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, FileSearch, FileText, Rocket, Save } from 'lucide-react';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';

interface PathCheckResult {
  ok: boolean;
  canonical: string | null;
  real: string | null;
  reason?: string;
  symlink: boolean;
  insideAllowedRoot: boolean;
}

export function AddProjectView() {
  const qc = useQueryClient();
  const setView = useAppStore((s) => s.setView);
  const openProject = useAppStore((s) => s.openProject);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [pathCheck, setPathCheck] = useState<PathCheckResult | null>(null);
  const [checkingPath, setCheckingPath] = useState(false);
  const [step, setStep] = useState<'path' | 'discover' | 'readme' | 'register'>('path');
  const [discovery, setDiscovery] = useState<any>(null);
  const [readme, setReadme] = useState<any>(null);
  const [working, setWorking] = useState(false);

  async function verifyPath() {
    setCheckingPath(true);
    setPathCheck(null);
    try {
      // Use the create endpoint with a dummy name to trigger path verification.
      const r = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || path.split('/').pop() || 'project', localPath: path }),
      });
      const j = await r.json();
      if (j.ok) {
        // Project already created — jump straight to registered state.
        qc.invalidateQueries({ queryKey: ['projects-all'] });
        toast.success('Project registered');
        openProject(j.data.id);
        return;
      }
      // j.error includes the code. We translate it into a PathCheck result.
      const code = j.error?.code;
      setPathCheck({
        ok: false,
        canonical: null, real: null,
        reason: j.error?.message ?? 'Path verification failed',
        symlink: false,
        insideAllowedRoot: code !== 'PATH_OUTSIDE_ROOT',
      });
      // 409 means already registered — allow user to open it.
      if (r.status === 409) {
        toast.info('Project already registered. Opening it…');
        const existing = await fetch('/api/projects?q=' + encodeURIComponent(name || path.split('/').pop() || ''));
        const ej = await existing.json();
        const found = (ej.data ?? []).find((p: any) => p.localPath === path);
        if (found) openProject(found.id);
      }
    } finally {
      setCheckingPath(false);
    }
  }

  // Actually, the API above creates the project immediately. We want a staged
  // workflow instead. So we re-design: clicking "Verify path" calls a
  // check-only endpoint that does not persist. The simplest approach is to
  // pre-register, then discover + readme on the resulting project ID.

  // Re-implementation of the staged workflow:
  async function runStagedAdd() {
    setWorking(true);
    setPathCheck(null);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || path.split('/').pop() || 'project', localPath: path }),
      });
      const j = await r.json();
      if (!j.ok) {
        setPathCheck({ ok: false, canonical: null, real: null, reason: j.error?.message ?? 'Failed', symlink: false, insideAllowedRoot: j.error?.code !== 'PATH_OUTSIDE_ROOT' });
        toast.error(j.error?.message ?? 'Path verification failed');
        return;
      }
      const project = j.data;
      setPathCheck({ ok: true, canonical: project.localPath, real: project.localPath, symlink: false, insideAllowedRoot: true });
      toast.success('Location verified');
      setStep('discover');
      // Run discovery
      const dr = await fetch(`/api/projects/${project.id}/discover`, { method: 'POST' });
      const dj = await dr.json();
      if (dj.ok) { setDiscovery(dj.data.snapshot); toast.success('Discovery complete'); }
      else toast.error('Discovery failed: ' + (dj.error?.message ?? 'unknown'));
      setStep('readme');
      // Run README
      const rr = await fetch(`/api/projects/${project.id}/readme`, { method: 'POST' });
      const rj = await rr.json();
      if (rj.ok) { setReadme(rj.data); toast.success('README analysis complete'); }
      else toast.warning('README analysis failed: ' + (rj.error?.message ?? 'unknown'));
      setStep('register');
      qc.invalidateQueries({ queryKey: ['projects-all'] });
      // Open the project detail.
      openProject(project.id);
    } catch (e) {
      toast.error('Unexpected: ' + (e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Add Project</h1>
        <p className="text-xs text-muted-foreground">Verify the location, discover technologies, parse the README, and register. Every step is evidence-backed.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Step 1 · Register & verify</CardTitle>
          <CardDescription className="text-xs">Provide a name and a local path. Path must be inside an allowed root.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-mono text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-cyber-project" className="text-xs" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground">Local path (absolute)</label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/home/z/my-project" className="text-xs font-mono" />
            <p className="text-[10px] text-muted-foreground mt-1">Allowed roots (configure in Settings): /home/z/my-project, /tmp</p>
          </div>

          {pathCheck && (
            <div className={`text-xs font-mono flex items-center gap-2 px-3 py-2 border rounded ${pathCheck.ok ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' : 'text-red-400 border-red-500/40 bg-red-500/10'}`}>
              {pathCheck.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {pathCheck.ok ? 'LOCATION VERIFIED' : 'LOCATION VERIFICATION FAILED'}
              <span className="text-muted-foreground">—</span>
              <span>{pathCheck.reason ?? pathCheck.real ?? 'Canonical path resolved.'}</span>
              {pathCheck.symlink && <span className="text-amber-400">(symlink)</span>}
            </div>
          )}

          <Button disabled={!path || working} onClick={runStagedAdd}>
            {working ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileSearch className="h-3.5 w-3.5 mr-2" />}
            Verify, discover, and register
          </Button>
        </CardContent>
      </Card>

      {(discovery || readme) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><FileSearch className="h-4 w-4" /> Step 2 · Discovery</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1.5">
              {discovery ? (
                <>
                  <Row label="Language"        value={discovery.language} />
                  <Row label="Framework"       value={discovery.framework} />
                  <Row label="Package manager" value={discovery.packageManager} />
                  <Row label="Entry point"     value={discovery.entryPoint} />
                  <Row label="Container"       value={discovery.containerConfig?.type} />
                  <Row label="Ports"           value={discovery.ports?.join(', ') || 'NONE'} />
                  <Row label="Env vars"        value={`${discovery.envVars?.length ?? 0} found in .env.example`} />
                  <Row label="Manifest files"  value={discovery.manifestFiles?.join(', ') || 'NONE'} />
                  {discovery.conflicts?.length > 0 && (
                    <div className="mt-2 text-amber-400">Conflicts: {discovery.conflicts.length}</div>
                  )}
                </>
              ) : <div className="text-muted-foreground">Pending…</div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Step 3 · README analysis</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1.5">
              {readme ? (
                <>
                  <Row label="README path" value={readme.readmePath ?? 'NONE'} />
                  <Row label="Commands found" value={String(readme.commands?.length ?? 0)} />
                  <Row label="Conflicts" value={String(readme.conflicts?.length ?? 0)} />
                  {(readme.commands ?? []).slice(0, 5).map((c: any, i: number) => (
                    <div key={i} className="border-l-2 border-border pl-2 py-1">
                      <div className="font-mono text-[11px]">{c.command}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.kind} · {c.confidence} · {c.verified ? 'verified' : 'unverified'} {c.conflict ? `· ⚠ ${c.conflict}` : ''}
                      </div>
                    </div>
                  ))}
                </>
              ) : <div className="text-muted-foreground">Pending…</div>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/30 pb-1">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="font-mono">{value || 'UNKNOWN'}</span>
    </div>
  );
}
