// Compliance — GDPR/NIS2/CRA/DORA/EU-AI-ACT control catalogue with applicability editor.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useState } from 'react';

const DISCLAIMER = 'This system provides technical compliance-readiness support, control mapping, evidence management, and gap analysis. It does not constitute legal advice, certification, or a guarantee of regulatory compliance.';

export function ComplianceView() {
  const frameworks = useQuery({
    queryKey: ['compliance'],
    queryFn: async () => { const r = await fetch('/api/compliance'); const j = await r.json(); return j.data ?? []; },
  });
  const all: any[] = frameworks.data ?? [];
  const [active, setActive] = useState<string>('');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Compliance-Readiness</h1>
        <p className="text-xs text-muted-foreground">Catalogue of European regulatory frameworks and their controls. Applicability is per-control and reviewable.</p>
      </div>
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-3 text-xs flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-amber-200">{DISCLAIMER}</span>
        </CardContent>
      </Card>

      {all.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><div className="text-xs font-mono text-muted-foreground">NO FRAMEWORKS</div></CardContent></Card>
      ) : (
        <Tabs value={active || all[0]?.code} onValueChange={setActive}>
          <TabsList className="text-xs">
            {all.map((f) => <TabsTrigger key={f.code} value={f.code} className="text-xs">{f.code}</TabsTrigger>)}
          </TabsList>
          {all.map((f) => (
            <TabsContent key={f.code} value={f.code}>
              <FrameworkDetail fw={f} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function FrameworkDetail({ fw }: { fw: any }) {
  const qc = useQueryClient();
  async function update(control: any, field: 'applicability' | 'status' | 'evidence', value: string) {
    try {
      const r = await fetch(`/api/compliance/${fw.id}/controls/${control.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      const j = await r.json();
      if (j.ok) toast.success('Control updated');
      else toast.error(j.error?.message ?? 'Update failed');
      qc.invalidateQueries({ queryKey: ['compliance'] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-3 mt-2">
      <Card>
        <CardContent className="py-3 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Name</span>
            <span className="font-mono">{fw.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Kind</span>
            <span className={`inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded border ${
              fw.kind === 'regulation' ? 'text-red-400 border-red-500/40 bg-red-500/10' :
              fw.kind === 'directive' ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' :
              fw.kind === 'law' ? 'text-red-400 border-red-500/40 bg-red-500/10' :
              fw.kind === 'standard' ? 'text-blue-400 border-blue-500/40 bg-blue-500/10' :
              fw.kind === 'guidance' ? 'text-slate-400 border-slate-500/40 bg-slate-500/10' :
              'text-slate-400 border-slate-500/40 bg-slate-500/10'
            }`}>{fw.kind.toUpperCase()}</span>
            <span className="text-[10px] text-muted-foreground ml-2">
              (LAW · REGULATION · DIRECTIVE · DELEGATED ACT · IMPLEMENTING ACT · STANDARD · CERTIFICATION · GUIDANCE · BEST PRACTICE — only the kind label above applies to this framework)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Source</span>
            <a href={fw.officialUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono">{fw.officialUrl}</a>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-1.5">
        {fw.controls.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="py-2.5 text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="font-mono font-medium shrink-0">{c.code}</span>
                <span className="font-medium">{c.title}</span>
              </div>
              <div className="text-muted-foreground">{c.description}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Applicability</label>
                  <Select value={c.applicability} onValueChange={(v) => update(c, 'applicability', v)}>
                    <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPLICABLE">APPLICABLE</SelectItem>
                      <SelectItem value="POSSIBLY_APPLICABLE">POSSIBLY_APPLICABLE</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">NOT_APPLICABLE</SelectItem>
                      <SelectItem value="REVIEW_REQUIRED">REVIEW_REQUIRED</SelectItem>
                      <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</label>
                  <Select value={c.status} onValueChange={(v) => update(c, 'status', v)}>
                    <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gap">gap</SelectItem>
                      <SelectItem value="partial">partial</SelectItem>
                      <SelectItem value="met">met</SelectItem>
                      <SelectItem value="unknown">unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Last reviewed</label>
                  <div className="text-[10px] text-muted-foreground font-mono">{c.lastReviewedAt ? new Date(c.lastReviewedAt).toISOString().slice(0,19).replace("T"," ") + "Z" : 'never'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
