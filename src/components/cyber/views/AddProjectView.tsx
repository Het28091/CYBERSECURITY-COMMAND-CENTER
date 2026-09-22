// Add Project — source selection: LOCAL or GITHUB.
// LOCAL: path → discover → readme → register.
// GITHUB: URL → clone → discover → readme → register.
// Both follow the same security policy — README has NO authority to execute.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, FileSearch, FileText, FolderKanban, Github, Lock, AlertTriangle } from 'lucide-react';
import { useAppStore } from '@/stores/app';
import { toast } from 'sonner';

type Source = 'LOCAL' | 'GITHUB';

interface ProgressStep {
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
}

export function AddProjectView() {
  const qc = useQueryClient();
  const openProject = useAppStore((s) => s.openProject);
  const [source, setSource] = useState<Source>('LOCAL');

  // Local fields
  const [localName, setLocalName] = useState('');
  const [localPath, setLocalPath] = useState('');

  // GitHub fields
  const [ghName, setGhName] = useState('');
  const [ghUrl, setGhUrl] = useState('');
  const [ghBranch, setGhBranch] = useState('');
  const [ghToken, setGhToken] = useState('');
  const [ghDryRun, setGhDryRun] = useState(false);

  const [working, setWorking] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [discovery, setDiscovery] = useState<any>(null);
  const [readme, setReadme] = useState<any>(null);
  const [githubResult, setGithubResult] = useState<any>(null);

  function updateStep(idx: number, status: ProgressStep['status'], detail?: string) {
    setSteps((prev) => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], status, detail };
      return next;
    });
  }

  async function addLocal() {
    setWorking(true);
    setDiscovery(null);
    setReadme(null);
    setGithubResult(null);
    const s: ProgressStep[] = [
      { label: 'Verify path', status: 'pending' },
      { label: 'Register project', status: 'pending' },
      { label: 'Discovery', status: 'pending' },
      { label: 'README analysis', status: 'pending' },
    ];
    setSteps(s);

    try {
      // Step 1+2: Register (which also verifies path)
      updateStep(0, 'running');
      const r = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: localName || localPath.split('/').pop() || 'project', localPath: localPath }),
      });
      const j = await r.json();
      if (!j.ok) {
        updateStep(0, 'failed', j.error?.message);
        toast.error(j.error?.message ?? 'Path verification failed');
        return;
      }
      updateStep(0, 'done', 'LOCATION VERIFIED');
      updateStep(1, 'done');
      const project = j.data;
      toast.success('Location verified');

      // Step 3: Discovery
      updateStep(2, 'running');
      const dr = await fetch(`/api/projects/${project.id}/discover`, { method: 'POST' });
      const dj = await dr.json();
      if (dj.ok) { setDiscovery(dj.data.snapshot); updateStep(2, 'done', `${dj.data.snapshot.manifestFiles?.length ?? 0} manifests`); toast.success('Discovery complete'); }
      else { updateStep(2, 'failed', dj.error?.message); toast.error('Discovery failed'); }

      // Step 4: README
      updateStep(3, 'running');
      const rr = await fetch(`/api/projects/${project.id}/readme`, { method: 'POST' });
      const rj = await rr.json();
      if (rj.ok) { setReadme(rj.data); updateStep(3, 'done', `${rj.data.commands?.length ?? 0} commands`); toast.success('README analysis complete'); }
      else { updateStep(3, 'failed', rj.error?.message); toast.warning('README analysis incomplete'); }

      qc.invalidateQueries({ queryKey: ['projects-all'] });
      openProject(project.id);
    } catch (e) {
      toast.error('Unexpected: ' + (e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function addGithub() {
    setWorking(true);
    setDiscovery(null);
    setReadme(null);
    setGithubResult(null);
    const isDryRun = ghDryRun;
    const s: ProgressStep[] = [
      { label: 'Validate URL', status: 'pending' },
      { label: `Clone ${ghBranch ? `branch=${ghBranch}` : 'default branch'}`, status: 'pending' },
      { label: 'Record commit SHA', status: 'pending' },
      ...(isDryRun ? [] : [{ label: 'Register project', status: 'pending' } as ProgressStep]),
      ...(isDryRun ? [] : [{ label: 'Discovery', status: 'pending' } as ProgressStep]),
      ...(isDryRun ? [] : [{ label: 'README analysis', status: 'pending' } as ProgressStep]),
    ];
    setSteps(s);

    try {
      // Step 1: Validate URL + clone (single API call)
      updateStep(0, 'running');
      updateStep(1, 'running');
      const body: any = {
        repoUrl: ghUrl,
        name: ghName || ghUrl.split('/').pop()?.replace('.git', '') || 'github-project',
        dryRun: isDryRun,
      };
      if (ghBranch) body.branch = ghBranch;
      if (ghToken) body.accessToken = ghToken;

      const r = await fetch('/api/projects/import-github', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) {
        updateStep(0, 'failed', j.error?.message);
        updateStep(1, 'failed');
        toast.error(j.error?.message ?? 'GitHub import failed');
        return;
      }
      const data = j.data;
      updateStep(0, 'done', `${data.repoOwner}/${data.repoName}`);
      updateStep(1, 'done', `${data.sizeMB?.toFixed(1)} MB`);
      updateStep(2, 'done', data.commitSha?.slice(0, 12));
      setGithubResult(data);

      if (isDryRun) {
        toast.success(`Dry-run complete: ${data.repoOwner}/${data.repoName}@${data.commitSha?.slice(0, 12)}`);
      } else {
        updateStep(3, 'done');
        // Discovery
        updateStep(4, 'running');
        const dr = await fetch(`/api/projects/${data.project.id}/discover`, { method: 'POST' });
        const dj = await dr.json();
        if (dj.ok) { setDiscovery(dj.data.snapshot); updateStep(4, 'done', `${dj.data.snapshot.manifestFiles?.length ?? 0} manifests`); }
        else { updateStep(4, 'failed', dj.error?.message); }

        // README
        updateStep(5, 'running');
        const rr = await fetch(`/api/projects/${data.project.id}/readme`, { method: 'POST' });
        const rj = await rr.json();
        if (rj.ok) { setReadme(rj.data); updateStep(5, 'done', `${rj.data.commands?.length ?? 0} commands`); }
        else { updateStep(5, 'failed', rj.error?.message); }

        qc.invalidateQueries({ queryKey: ['projects-all'] });
        toast.success(`Imported: ${data.repoOwner}/${data.repoName}@${data.commitSha?.slice(0, 12)}`);
        openProject(data.project.id);
      }
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
        <p className="text-xs text-muted-foreground">Choose a source: local filesystem or GitHub repository. Both follow the same security policy — README has NO authority to execute commands.</p>
      </div>

      {/* Source selector */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSource('LOCAL')}
          className={`flex items-center gap-3 p-4 border rounded-lg transition-colors ${source === 'LOCAL' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}
        >
          <FolderKanban className="h-6 w-6 text-primary" />
          <div className="text-left">
            <div className="text-sm font-medium">Local Project</div>
            <div className="text-[11px] text-muted-foreground">From a directory on this machine</div>
          </div>
        </button>
        <button
          onClick={() => setSource('GITHUB')}
          className={`flex items-center gap-3 p-4 border rounded-lg transition-colors ${source === 'GITHUB' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'}`}
        >
          <Github className="h-6 w-6 text-primary" />
          <div className="text-left">
            <div className="text-sm font-medium">GitHub Repository</div>
            <div className="text-[11px] text-muted-foreground">Clone + analyze (untrusted)</div>
          </div>
        </button>
      </div>

      {source === 'LOCAL' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><FolderKanban className="h-4 w-4" /> Local Project</CardTitle>
            <CardDescription className="text-xs">Provide a name and a local path. Path must be inside an allowed root (configure in Settings).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground">Name</label>
              <Input value={localName} onChange={(e) => setLocalName(e.target.value)} placeholder="my-cyber-project" className="text-xs" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground">Local path (absolute)</label>
              <Input value={localPath} onChange={(e) => setLocalPath(e.target.value)} placeholder="/home/z/my-project" className="text-xs font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">Allowed roots: /home/z/my-project, /tmp, /home/z/my-project/cyber-center-data/github</p>
            </div>
            <Button disabled={!localPath || working} onClick={addLocal}>
              {working ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileSearch className="h-3.5 w-3.5 mr-2" />}
              Verify, discover, and register
            </Button>
          </CardContent>
        </Card>
      )}

      {source === 'GITHUB' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Github className="h-4 w-4" /> GitHub Repository</CardTitle>
            <CardDescription className="text-xs">
              Clones into an isolated sandbox at <code className="font-mono">/cyber-center-data/github/&lt;owner&gt;/&lt;repo&gt;/&lt;sha&gt;/</code>.
              Shallow clone (depth 1), 50 MB limit, <code className="font-mono">.git</code> excluded from size.
              Repository contents are treated as untrusted — the command security policy applies to all cloned code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground">Repository URL</label>
              <Input value={ghUrl} onChange={(e) => setGhUrl(e.target.value)} placeholder="https://github.com/owner/repo" className="text-xs font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-muted-foreground">Branch (optional)</label>
                <Input value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} placeholder="main / master" className="text-xs font-mono" />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Access token (private repos)</label>
                <Input value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="ghp_… (never stored)" className="text-xs font-mono" type="password" />
              </div>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground">Project name</label>
              <Input value={ghName} onChange={(e) => setGhName(e.target.value)} placeholder="my-github-project" className="text-xs" />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={ghDryRun} onChange={(e) => setGhDryRun(e.target.checked)} className="h-3.5 w-3.5" />
              Dry run (clone + record SHA, but don't register as a project)
            </label>
            <div className="flex items-start gap-2 text-[10px] text-amber-200/80 bg-amber-500/5 border border-amber-500/20 rounded p-2">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Repository contents are untrusted. The runner will NOT execute any command from the README without passing the same command policy that applies to local projects. <code className="font-mono">npm install &lt;malicious&gt;</code> is NOT auto-verified.</span>
            </div>
            <Button disabled={!ghUrl || working} onClick={addGithub}>
              {working ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Github className="h-3.5 w-3.5 mr-2" />}
              {ghDryRun ? 'Dry-run clone' : 'Clone, analyze, and register'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress steps */}
      {steps.length > 0 && (
        <Card>
          <CardContent className="py-3 space-y-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {s.status === 'pending' && <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />}
                {s.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
                {s.status === 'done' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                {s.status === 'failed' && <XCircle className="h-3 w-3 text-red-400" />}
                <span className={s.status === 'done' ? 'text-foreground' : s.status === 'failed' ? 'text-red-400' : 'text-muted-foreground'}>
                  {s.label}
                </span>
                {s.detail && <span className="text-[10px] text-muted-foreground font-mono">— {s.detail}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* GitHub result */}
      {githubResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Github className="h-4 w-4" /> Clone result</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <Row label="Repository" value={`${githubResult.repoOwner}/${githubResult.repoName}`} />
            <Row label="Branch" value={githubResult.branch} />
            <Row label="Commit SHA" value={githubResult.commitSha} />
            <Row label="Size" value={`${githubResult.sizeMB?.toFixed(2)} MB`} />
            <Row label="Cloned to" value={githubResult.clonedPath} />
          </CardContent>
        </Card>
      )}

      {/* Discovery + README results */}
      {(discovery || readme) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {discovery && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><FileSearch className="h-4 w-4" /> Discovery</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <Row label="Language"        value={discovery.language} />
                <Row label="Framework"       value={discovery.framework} />
                <Row label="Package manager" value={discovery.packageManager} />
                <Row label="Entry point"     value={discovery.entryPoint} />
                <Row label="Container"       value={discovery.containerConfig?.type} />
                <Row label="Ports"           value={discovery.ports?.join(', ') || 'NONE'} />
                <Row label="Manifest files"  value={discovery.manifestFiles?.join(', ') || 'NONE'} />
              </CardContent>
            </Card>
          )}
          {readme && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> README analysis</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
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
              </CardContent>
            </Card>
          )}
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
