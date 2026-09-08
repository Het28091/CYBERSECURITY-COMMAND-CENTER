// Sidebar — main navigation. Switches views via the Zustand store.

import { NAV_ITEMS, ViewId } from '@/lib/cyber/types';
import { useAppStore } from '@/stores/app';
import * as Icons from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const GROUPS = ['Workspace', 'Security', 'Governance', 'System'] as const;

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn('flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all', collapsed ? 'w-14' : 'w-56')}>
      <div className="h-14 flex items-center px-3 border-b gap-2">
        <ShieldHalf className="h-5 w-5 text-primary" />
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold tracking-wider text-primary">CYBER COMMAND</span>
            <span className="text-[10px] font-mono text-muted-foreground">v0 · spiral 0</span>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto cyber-scroll py-2">
        {GROUPS.map((g) => (
          <div key={g} className="mb-2">
            {!collapsed && <div className="px-3 py-1 text-[10px] font-mono text-muted-foreground/70 tracking-widest uppercase">{g}</div>}
            {NAV_ITEMS.filter((n) => n.group === g).map((item) => {
              const Icon = (Icons as any)[item.icon] ?? Icons.Circle;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-sidebar-accent transition-colors',
                    active && 'bg-sidebar-accent text-sidebar-foreground border-l-2 border-primary',
                    !active && 'border-l-2 border-transparent',
                    collapsed && 'justify-center',
                  )}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="h-9 border-t text-xs flex items-center justify-center gap-2 hover:bg-sidebar-accent"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <><ChevronLeft className="h-3.5 w-3.5" /> Collapse</>}
      </button>
    </aside>
  );
}

import { ShieldHalf, ChevronLeft, ChevronRight } from 'lucide-react';
