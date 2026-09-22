// Settings — view + edit settings + change password.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';

export function SettingsView() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const refresh = useAuthStore((s) => s.refresh);
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

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

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

  async function changePassword() {
    if (newPw !== confirmPw) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (!currentPw || !newPw) {
      toast.error('Both current and new password are required');
      return;
    }
    setChangingPw(true);
    try {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success('Password changed. All sessions revoked. Please log in again.');
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        // Refresh auth — this will redirect to login since all sessions are revoked.
        await refresh();
      } else {
        toast.error(j.error?.message ?? 'Password change failed');
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Configure allowed roots, timeouts, feature flags, and security.</p>
      </div>

      {/* Password change */}
      {user && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Change Password</CardTitle>
            <CardDescription className="text-xs">
              Change the admin password. All existing sessions will be revoked — you will need to log in again.
              Password must be at least 8 characters with at least one letter and one number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground">Current password</label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="text-xs font-mono" autoComplete="current-password" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground">New password</label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="text-xs font-mono" autoComplete="new-password" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground">Confirm new password</label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="text-xs font-mono" autoComplete="new-password" />
            </div>
            {newPw && newPw !== confirmPw && (
              <div className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Passwords do not match</div>
            )}
            {newPw && newPw === confirmPw && newPw.length >= 8 && (
              <div className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Password looks good</div>
            )}
            <Button onClick={changePassword} disabled={changingPw || !currentPw || !newPw || newPw !== confirmPw}>
              {changingPw ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Lock className="h-3.5 w-3.5 mr-2" />}
              Change password
            </Button>
          </CardContent>
        </Card>
      )}

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
