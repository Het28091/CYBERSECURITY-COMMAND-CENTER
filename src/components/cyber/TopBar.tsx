// TopBar — premium navigation bar with surface hierarchy and user status.

import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Search, Command, Moon, Sun, LogOut, User as UserIcon, Activity } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function TopBar() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setGlobalSearchOpen = useAppStore((s) => s.setGlobalSearchOpen);
  const setView = useAppStore((s) => s.setView);
  const user = useAuthStore((s) => s.user);
  const authDisabled = useAuthStore((s) => s.authDisabled);
  const logout = useAuthStore((s) => s.logout);
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const r = await fetch('/api/system/health');
      if (!r.ok) return null;
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
    retry: false,
  });

  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCommandPaletteOpen, setGlobalSearchOpen]);

  const overall = health.data?.overall ?? 'UNKNOWN';
  const healthColor =
    overall === 'HEALTHY' ? 'text-signal-ok' :
    overall === 'DEGRADED' ? 'text-signal-warn' :
    'text-signal-fail';

  const roleColor =
    user?.role === 'ADMIN' ? 'border-red-500/30 bg-red-500/10 text-red-300' :
    user?.role === 'OPERATOR' ? 'border-blue-500/30 bg-blue-500/10 text-blue-300' :
    'border-slate-500/30 bg-slate-500/10 text-slate-300';

  return (
    <header className="h-12 border-b cyber-edge bg-surface-1 flex items-center px-4 gap-3 shrink-0 cyber-z-header">
      {/* Logo click → dashboard */}
      <button
        onClick={() => setView('command-center')}
        className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', overall === 'HEALTHY' ? 'bg-signal-ok cyber-pulse' : 'bg-signal-fail')} />
        <span className="hidden sm:inline">CYBER COMMAND CENTER</span>
      </button>

      {/* Search + command */}
      <div className="hidden md:flex items-center gap-2 ml-3">
        <Button size="sm" variant="outline" onClick={() => setGlobalSearchOpen(true)} className="gap-2 h-7 text-[11px] bg-surface-2 cyber-edge-subtle">
          <Search className="h-3 w-3" />
          <span>Search…</span>
          <kbd className="text-[9px] font-mono px-1 py-0.5 bg-surface-3 rounded">⌘/</kbd>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCommandPaletteOpen(true)} className="gap-2 h-7 text-[11px] bg-surface-2 cyber-edge-subtle">
          <Command className="h-3 w-3" />
          <kbd className="text-[9px] font-mono px-1 py-0.5 bg-surface-3 rounded">⌘K</kbd>
        </Button>
      </div>

      <div className="flex-1" />

      {/* System health */}
      <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-muted-foreground/70">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          <span className={healthColor}>{overall}</span>
        </span>
        <span className="tabular-nums">{mounted ? new Date().toISOString().slice(0, 19) + 'Z' : ''}</span>
      </div>

      {/* Theme toggle */}
      <Button size="icon" variant="ghost" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="h-7 w-7">
        {mounted && (resolvedTheme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />)}
      </Button>

      {/* User + role + logout */}
      {user && (
        <div className="flex items-center gap-2.5 pl-3 border-l cyber-edge-subtle">
          <div className="flex flex-col items-end leading-tight gap-0.5">
            <span className="text-[11px] font-mono flex items-center gap-1 text-foreground/80">
              <UserIcon className="h-2.5 w-2.5 text-muted-foreground" />
              {user.name}
            </span>
            {authDisabled ? (
              <span className="text-[9px] text-signal-warn font-mono">AUTH DISABLED</span>
            ) : (
              <Badge variant="outline" className={`text-[8px] font-mono px-1 py-0 ${roleColor}`}>{user.role}</Badge>
            )}
          </div>
          {!authDisabled && (
            <Button size="sm" variant="ghost" onClick={() => logout()} aria-label="Sign out" className="h-7 px-2 gap-1 text-[11px]">
              <LogOut className="h-3 w-3" />
              <span className="hidden lg:inline">Sign out</span>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

import { cn } from '@/lib/utils';
