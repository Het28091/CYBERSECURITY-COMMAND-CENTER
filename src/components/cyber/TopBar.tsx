// Top bar — global search trigger, command palette trigger, theme toggle, status indicator.

import { useAppStore } from '@/stores/app';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Search, Command, Activity, Moon, Sun, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function TopBar() {
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setGlobalSearchOpen = useAppStore((s) => s.setGlobalSearchOpen);
  const setView = useAppStore((s) => s.setView);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const r = await fetch('/api/system/health');
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Keyboard: Cmd+K / Ctrl+K opens the command palette.
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
  const overallColor =
    overall === 'HEALTHY' ? 'text-emerald-400' :
    overall === 'DEGRADED' ? 'text-amber-400' :
    'text-red-400';

  return (
    <header className="h-14 border-b bg-background/80 backdrop-blur flex items-center px-4 gap-3 sticky top-0 z-30">
      <button onClick={() => setView('command-center')} className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary cyber-pulse" />
        CYBER COMMAND CENTER
      </button>
      <div className="hidden md:flex items-center gap-2 ml-4">
        <Button size="sm" variant="outline" onClick={() => setGlobalSearchOpen(true)} className="gap-2">
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Search everything…</span>
          <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded border">⌘/</kbd>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCommandPaletteOpen(true)} className="gap-2">
          <Command className="h-3.5 w-3.5" />
          <span className="text-xs">Command palette</span>
          <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded border">⌘K</kbd>
        </Button>
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-4 text-[11px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          <span className={overallColor}>SYSTEM: {overall}</span>
        </span>
        <span className="text-muted-foreground/70">{mounted ? new Date().toISOString().slice(0, 19) + 'Z' : ''}</span>
      </div>

      <Button size="icon" variant="ghost" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
        {mounted && (resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />)}
      </Button>
    </header>
  );
}
