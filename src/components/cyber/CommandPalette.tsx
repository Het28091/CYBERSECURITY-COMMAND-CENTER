// Command palette — Cmd+K. Lets the user jump to any view or trigger common actions.

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/app';
import { NAV_ITEMS, ViewId } from '@/lib/cyber/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import * as Icons from 'lucide-react';

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setView = useAppStore((s) => s.setView);
  const openProject = useAppStore((s) => s.openProject);
  const [recentProjects, setRecentProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (open) {
      fetch('/api/projects?limit=5').then((r) => r.json()).then((j) => setRecentProjects((j.data ?? []).map((p: any) => ({ id: p.id, name: p.name })))).catch(() => {});
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 max-w-xl">
        <Command>
          <CommandInput placeholder="Type a command or search…" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No matches found.</CommandEmpty>
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => { setView('add-project'); setOpen(false); }}>
                <Icons.PlusCircle className="h-4 w-4" /> Add a project
              </CommandItem>
              <CommandItem onSelect={() => { setView('running'); setOpen(false); }}>
                <Icons.Activity className="h-4 w-4" /> View running projects
              </CommandItem>
              <CommandItem onSelect={() => { setView('cves'); setOpen(false); }}>
                <Icons.ShieldAlert className="h-4 w-4" /> Search CVEs
              </CommandItem>
              <CommandItem onSelect={() => { setView('tools'); setOpen(false); }}>
                <Icons.Wrench className="h-4 w-4" /> Browse security tools
              </CommandItem>
              <CommandItem onSelect={() => { setView('owasp'); setOpen(false); }}>
                <Icons.Shield className="h-4 w-4" /> Open OWASP knowledge
              </CommandItem>
              <CommandItem onSelect={() => { setView('compliance'); setOpen(false); }}>
                <Icons.Scale className="h-4 w-4" /> Open compliance
              </CommandItem>
            </CommandGroup>

            {recentProjects.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent projects">
                  {recentProjects.map((p) => (
                    <CommandItem key={p.id} onSelect={() => { openProject(p.id); setOpen(false); }}>
                      <Icons.FolderKanban className="h-4 w-4" /> {p.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading="Navigate">
              {NAV_ITEMS.map((n) => {
                const Icon = (Icons as any)[n.icon] ?? Icons.Circle;
                return (
                  <CommandItem key={n.id} onSelect={() => { setView(n.id as ViewId); setOpen(false); }}>
                    <Icon className="h-4 w-4" /> {n.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
