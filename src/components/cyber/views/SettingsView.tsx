// Settings — view + edit settings.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export function SettingsView() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const r = await fetch('/api/settings'); const j = await r.json(); return j.data; },
  });
  const s = settings.data;
  const [roots, setRoots] = useState<string>('');
  const [timeoutMs, setTimeoutMs] = useState<number>(60000);
  const [maxLogs, setMaxLogs] = useState<number>(5000);
  const [typo, setTypo] = useState(true);
  const [bind, setBind] = useState(true);
  const [external, setExternal] = useState(true);
  const [ai, setAi] = useState(true);

  if (s && roots === '' && s.allowedProjectRoots?.length) {
    setRoots(s.allowedProjectRoots.join('\n'));
    setTimeoutMs(s.commandTimeoutMs);
    setMaxLogs(s.maxLogLinesPerProject);
    setTypo(s.typoCorrection);
    setBind(s.bindLocalhost);
    setExternal(s.externalFetchEnabled);
    setAi(s.aiAssistanceEnabled);
  }

  async function save() {
    try {
      const r = await fetch('/api/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedProjectRoots: roots.split('\n').map((x) => x.trim()).filter(Boolean),
          commandTimeoutMs: timeoutMs,
          maxLogLinesPerProject: maxLogs,
          typoCorrection: typo,
          bindLocalhost: bind,
          externalFetchEnabled: external,
          aiAssistanceEnabled: ai,
        }),
      });
      const j = await r.json();
      if (j.ok) toast.success('Settings saved');
      else toast.error(j.error?.message ?? 'Save failed');
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Configure allowed roots, timeouts, and feature flags.</p>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Allowed project roots</CardTitle><CardDescription className="text-xs">One absolute path per line. Project paths outside these roots are refused.</CardDescription></CardHeader>
        <CardContent>
          <textarea value={roots} onChange={(e) => setRoots(e.target.value)} rows={5} className="w-full font-mono text-xs border rounded p-2 bg-muted/20" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Runtime</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <NumRow label="Command timeout (ms)" value={timeoutMs} onChange={setTimeoutMs} min={1000} max={3600000} step={1000} />
          <NumRow label="Max log lines per project" value={maxLogs} onChange={setMaxLogs} min={100} max={100000} step={100} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Feature flags</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <SwitchRow label="Typo correction (natural-language only)" checked={typo} onChange={setTypo} />
          <SwitchRow label="Bind to localhost only" checked={bind} onChange={setBind} />
          <SwitchRow label="External data fetches (OSV.dev, NVD)" checked={external} onChange={setExternal} />
          <SwitchRow label="AI assistance" checked={ai} onChange={setAi} />
        </CardContent>
      </Card>
      <Button onClick={save}>Save settings</Button>
    </div>
  );
}

function NumRow({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; step: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs flex-1">{label}</span>
      <Input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="w-32 text-xs" />
    </div>
  );
}
function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs flex-1">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
