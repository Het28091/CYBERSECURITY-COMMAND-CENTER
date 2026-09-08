// Global search dialog — Ctrl+/ or Cmd+/. Searches across projects, tools, OWASP,
// AI security, compliance, and audit events.

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/app';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAppStore as useStore } from '@/stores/app';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderKanban, Wrench, Shield, Bot, Scale, ClipboardList, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface SearchResult {
  projects: { id: string; name: string; localPath: string; status: string }[];
  tools: { id: string; name: string; category: string; purpose: string; officialUrl: string }[];
  owasp: { id: string; list: string; rank: string; name: string; officialUrl: string }[];
  aiSecurity: { id: string; category: string; name: string; officialUrl: string }[];
  compliance: { frameworkCode: string; code: string; title: string; applicability: string; status: string }[];
  audit: { id: string; ts: string; action: string; objectType: string; result: string }[];
}

export function GlobalSearch() {
  const open = useAppStore((s) => s.globalSearchOpen);
  const setOpen = useAppStore((s) => s.setGlobalSearchOpen);
  const openProject = useStore((s) => s.openProject);
  const setView = useStore((s) => s.setView);
  const [q, setQ] = useState('');

  // Debounce the query.
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 250); return () => clearTimeout(t); }, [q]);

  const results = useQuery<SearchResult>({
    queryKey: ['global-search', debounced],
    queryFn: async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
      const j = await r.json();
      return j.data;
    },
    enabled: open && debounced.length > 1,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0">
        <div className="p-4 border-b">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects, tools, OWASP, AI security, compliance, audit…"
            className="text-sm"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Typo correction is applied to natural-language words only. Paths, CVE IDs, and package names are passed verbatim.
          </p>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 space-y-4">
            {results.isLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Searching…</div>}
            {results.data && (
              <>
                <Section icon={FolderKanban} title={`Projects (${results.data.projects.length})`}>
                  {results.data.projects.map((p) => (
                    <button key={p.id} onClick={() => { openProject(p.id); setOpen(false); }} className="block w-full text-left text-xs px-2 py-1 hover:bg-muted rounded">
                      <span className="font-mono">{p.name}</span> <span className="text-muted-foreground">— {p.status}</span>
                    </button>
                  ))}
                  {results.data.projects.length === 0 && <Empty />}
                </Section>
                <Section icon={Wrench} title={`Tools (${results.data.tools.length})`}>
                  {results.data.tools.map((t) => (
                    <button key={t.id} onClick={() => { setView('tools'); setOpen(false); }} className="block w-full text-left text-xs px-2 py-1 hover:bg-muted rounded">
                      <span className="font-mono">{t.name}</span> <span className="text-muted-foreground">— {t.category}</span>
                    </button>
                  ))}
                  {results.data.tools.length === 0 && <Empty />}
                </Section>
                <Section icon={Shield} title={`OWASP (${results.data.owasp.length})`}>
                  {results.data.owasp.map((o) => (
                    <button key={o.id} onClick={() => { setView('owasp'); setOpen(false); }} className="block w-full text-left text-xs px-2 py-1 hover:bg-muted rounded">
                      <span className="font-mono">{o.rank} {o.name}</span> <span className="text-muted-foreground">— {o.list}</span>
                    </button>
                  ))}
                  {results.data.owasp.length === 0 && <Empty />}
                </Section>
                <Section icon={Bot} title={`AI Security (${results.data.aiSecurity.length})`}>
                  {results.data.aiSecurity.map((a) => (
                    <button key={a.id} onClick={() => { setView('ai-security'); setOpen(false); }} className="block w-full text-left text-xs px-2 py-1 hover:bg-muted rounded">
                      <span className="font-mono">{a.name}</span> <span className="text-muted-foreground">— {a.category}</span>
                    </button>
                  ))}
                  {results.data.aiSecurity.length === 0 && <Empty />}
                </Section>
                <Section icon={Scale} title={`Compliance (${results.data.compliance.length})`}>
                  {results.data.compliance.map((c, i) => (
                    <button key={`${c.code}-${i}`} onClick={() => { setView('compliance'); setOpen(false); }} className="block w-full text-left text-xs px-2 py-1 hover:bg-muted rounded">
                      <span className="font-mono">{c.frameworkCode} · {c.code}</span> <span className="text-muted-foreground">— {c.title}</span>
                    </button>
                  ))}
                  {results.data.compliance.length === 0 && <Empty />}
                </Section>
                <Section icon={ClipboardList} title={`Audit (${results.data.audit.length})`}>
                  {results.data.audit.map((a) => (
                    <button key={a.id} onClick={() => { setView('audit'); setOpen(false); }} className="block w-full text-left text-xs px-2 py-1 hover:bg-muted rounded">
                      <span className="font-mono">{a.action}</span> <span className="text-muted-foreground">— {a.objectType} ({a.result})</span>
                    </button>
                  ))}
                  {results.data.audit.length === 0 && <Empty />}
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-1"><Icon className="h-3.5 w-3.5" /> {title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function Empty() { return <div className="text-[11px] text-muted-foreground/60 px-2 py-0.5">No matches</div>; }
