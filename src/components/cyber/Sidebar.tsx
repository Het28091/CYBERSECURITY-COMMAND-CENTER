// Sidebar — premium cybersecurity navigation with surface hierarchy.

import { NAV_ITEMS, ViewId } from '@/lib/cyber/types';
import { useAppStore } from '@/stores/app';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';

const GROUPS = ['Workspace', 'Security', 'Governance', 'System'] as const;

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'flex flex-col border-r cyber-edge transition-all duration-200 cyber-z-sidebar',
      'bg-surface-1',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo area */}
      <div className="h-14 flex items-center px-4 border-b cyber-edge-subtle gap-2.5">
        <div className="relative flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 border border-primary/20">
          <Icons.ShieldHalf className="h-4 w-4 text-primary" />
          <div className="absolute inset-0 rounded-md bg-primary/5 blur-sm -z-10" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-semibold tracking-wider text-primary/90">CYBER COMMAND</span>
            <span className="text-[9px] font-mono text-muted-foreground/60 tracking-wider">v0 · SPIRAL 24</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto cyber-scroll py-3">
        {GROUPS.map((g) => (
          <div key={g} className="mb-3">
            {!collapsed && (
              <div className="px-4 py-1 cyber-label text-muted-foreground/40">{g}</div>
            )}
            {NAV_ITEMS.filter((n) => n.group === g).map((item) => {
              const Icon = (Icons as any)[item.icon] ?? Icons.Circle;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-all duration-150 group relative',
                    active
                      ? 'bg-primary/8 text-primary border-l-2 border-primary'
                      : 'text-muted-foreground border-l-2 border-transparent hover:bg-surface-3 hover:text-foreground',
                    collapsed && 'justify-center px-2',
                  )}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0 transition-transform', active ? 'scale-110' : 'group-hover:scale-105')} />
                  {!collapsed && <span className="truncate font-medium">{item.label}</span>}
                  {active && !collapsed && (
                    <div className="absolute right-2 w-1 h-4 rounded-full bg-primary/30" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="h-9 border-t cyber-edge-subtle flex items-center justify-center gap-2 text-[10px] cyber-label text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <Icons.ChevronRight className="h-3.5 w-3.5" /> : (
          <>
            <Icons.ChevronLeft className="h-3.5 w-3.5" />
            <span>COLLAPSE</span>
          </>
        )}
      </button>
    </aside>
  );
}
