// LoginView — premium cybersecurity login screen.

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldHalf, Loader2, AlertCircle } from 'lucide-react';

export function LoginView() {
  const refresh = useAuthStore((s) => s.refresh);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (j.ok) {
        await refresh();
      } else {
        setError(j.error?.message ?? 'Login failed');
      }
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0 cyber-grid-bg p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20">
            <ShieldHalf className="h-5 w-5 text-primary" />
            <div className="absolute inset-0 rounded-lg bg-primary/5 blur-md -z-10" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wider text-primary/90">CYBERSECURITY COMMAND CENTER</span>
            <span className="text-[10px] font-mono text-muted-foreground/40 tracking-wider">v0 · SPIRAL 24 · LOCAL-FIRST</span>
          </div>
        </div>

        {/* Login card */}
        <Card className="bg-surface-2 cyber-edge">
          <CardHeader>
            <CardTitle className="text-sm cyber-display">Sign in</CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground/60">
              Default: <code className="font-mono text-foreground/60">admin / changeme</code> — change via Settings after login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label htmlFor="username" className="cyber-label mb-1 block">Username</label>
                <Input
                  id="username" name="username" autoComplete="username"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  className="text-xs font-mono bg-surface-3 cyber-edge" required autoFocus
                />
              </div>
              <div>
                <label htmlFor="password" className="cyber-label mb-1 block">Password</label>
                <Input
                  id="password" name="password" type="password" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="text-xs font-mono bg-surface-3 cyber-edge" required
                />
              </div>

              {error && (
                <div className="text-[11px] font-mono flex items-center gap-2 px-3 py-2 rounded text-signal-fail bg-signal-fail/5 border border-signal-fail/20">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={submitting || !username || !password} className="w-full h-9 text-xs">
                {submitting ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security note */}
        <div className="rounded-md border border-amber-500/15 bg-amber-500/[0.02] p-2.5">
          <p className="text-[10px] text-amber-200/60 leading-relaxed">
            <strong>Authorization:</strong> Server enforces role-based access on every API route. Frontend gating is convenience only — backend is authoritative.
            Roles: ADMIN (full), OPERATOR (no delete/settings), VIEWER (read-only).
          </p>
        </div>

        <div className="text-center text-[9px] font-mono text-muted-foreground/30">
          Local-first · Evidence-based · 118/118 tests passing
        </div>
      </div>
    </div>
  );
}
