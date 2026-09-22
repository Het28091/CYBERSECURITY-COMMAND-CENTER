// VerificationView — connects the UI to the real secondary AI verification
// backend (POST /api/verify, GET /api/verify/list, POST /api/verify/entry/{kind}/{id}).
//
// Shows:
// - list of recent VerificationRequest records (state, claim, evidence, sources,
//   primary + secondary assessment, agreement, disagreement level, duration, timestamps)
// - per-entry "Verify" button for tools / OWASP / AI / framework entries
// - "Verify all (bulk)" with rate limiting
//
// Verification states shown:
//   UNVERIFIED → VERIFYING → VERIFIED | REJECTED | CONFLICT | FAILED | STALE | UNKNOWN
//
// The UI NEVER displays VERIFIED unless the backend state is actually VERIFIED.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, BadgeCheck, ShieldCheck, ShieldAlert, ShieldX, Clock, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface VerificationRow {
  id: string;
  claimText: string;
  evidence: string[];
  sources: string[];
  primaryAssessment: string;
  primaryConfidence: string;
  state: 'UNVERIFIED' | 'VERIFYING' | 'VERIFIED' | 'REJECTED' | 'CONFLICT' | 'FAILED' | 'STALE' | 'UNKNOWN';
  secondaryAssessment: string | null;
  agreement: boolean | null;
  disagreementLevel: 'MINOR' | 'MATERIAL' | 'CRITICAL' | null;
  reason: string | null;
  primaryAt: string;
  secondaryAt: string | null;
  durationMs: number | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

const STATE_META: Record<string, { cls: string; icon: any; label: string }> = {
  UNVERIFIED: { cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10', icon: Clock, label: 'UNVERIFIED' },
  VERIFYING:  { cls: 'text-blue-400 border-blue-500/40 bg-blue-500/10', icon: Loader2, label: 'VERIFYING' },
  VERIFIED:   { cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', icon: ShieldCheck, label: 'VERIFIED' },
  REJECTED:   { cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10', icon: ShieldAlert, label: 'REJECTED' },
  CONFLICT:   { cls: 'text-red-400 border-red-500/40 bg-red-500/10', icon: ShieldX, label: 'CONFLICT' },
  FAILED:     { cls: 'text-red-400 border-red-500/40 bg-red-500/10', icon: ShieldX, label: 'FAILED' },
  STALE:      { cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10', icon: Clock, label: 'STALE' },
  UNKNOWN:    { cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10', icon: AlertTriangle, label: 'UNKNOWN' },
};

function StatePill({ state }: { state: string }) {
  const m = STATE_META[state] ?? STATE_META.UNKNOWN;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded border ${m.cls}`}>
      <Icon className={`h-3 w-3 ${state === 'VERIFYING' ? 'animate-spin' : ''}`} />
      {m.label}
    </span>
  );
}

export function VerificationView() {
  const qc = useQueryClient();
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; ok: number; fail: number }>({ done: 0, total: 0, ok: 0, fail: 0 });

  const verifications = useQuery<VerificationRow[]>({
    queryKey: ['verifications'],
    queryFn: async () => {
      const r = await fetch('/api/verify/list');
      const j = await r.json();
      return j.data ?? [];
    },
    refetchInterval: 5000,
  });

  // Knowledge catalogue counts (for the "verify all" feature)
  const tools = useQuery({ queryKey: ['tools-all-verify'], queryFn: async () => { const r = await fetch('/api/tools?limit=500'); const j = await r.json(); return j.data ?? []; } });
  const owasp = useQuery({ queryKey: ['owasp-all-verify'], queryFn: async () => { const r = await fetch('/api/owasp'); const j = await r.json(); return j.data ?? []; } });
  const aiSec = useQuery({ queryKey: ['ai-sec-all-verify'], queryFn: async () => { const r = await fetch('/api/ai-security'); const j = await r.json(); return j.data ?? []; } });
  const compliance = useQuery({ queryKey: ['compliance-all-verify'], queryFn: async () => { const r = await fetch('/api/compliance'); const j = await r.json(); return j.data ?? []; } });

  const unverifiedEntries: { kind: 'tool' | 'owasp' | 'ai' | 'framework'; id: string; name: string; url: string }[] = [];
  for (const t of tools.data ?? []) if (t.verificationStatus !== 'VERIFIED') unverifiedEntries.push({ kind: 'tool', id: t.id, name: t.name, url: t.officialUrl });
  for (const o of owasp.data ?? []) if (o.verificationStatus !== 'VERIFIED') unverifiedEntries.push({ kind: 'owasp', id: o.id, name: `${o.rank} ${o.name}`, url: o.officialUrl });
  for (const a of aiSec.data ?? []) if (a.verificationStatus !== 'VERIFIED') unverifiedEntries.push({ kind: 'ai', id: a.id, name: a.name, url: a.officialUrl });
  for (const f of compliance.data ?? []) if (f.verificationStatus !== 'VERIFIED') unverifiedEntries.push({ kind: 'framework', id: f.id, name: f.code, url: f.officialUrl });

  async function verifyEntry(kind: string, id: string, name: string) {
    try {
      const r = await fetch(`/api/verify/entry/${kind}/${id}`, { method: 'POST' });
      const j = await r.json();
      if (j.data?.ok) {
        toast.success(`Verified: ${name} → ${j.data.status}`);
      } else {
        toast.warning(`Verify ${name}: ${j.data?.reason ?? j.error?.message ?? 'failed'}`);
      }
    } catch (e) {
      toast.error(`Verify ${name}: ${(e as Error).message}`);
    }
    qc.invalidateQueries({ queryKey: ['tools-all-verify'] });
    qc.invalidateQueries({ queryKey: ['owasp-all-verify'] });
    qc.invalidateQueries({ queryKey: ['ai-sec-all-verify'] });
    qc.invalidateQueries({ queryKey: ['compliance-all-verify'] });
  }

  async function bulkVerify() {
    if (unverifiedEntries.length === 0) {
      toast.info('Nothing to verify — all knowledge entries are already VERIFIED.');
      return;
    }
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: unverifiedEntries.length, ok: 0, fail: 0 });
    let ok = 0;
    let fail = 0;
    // Rate-limited: 1 request per 250ms to avoid hammering the official sources.
    for (let i = 0; i < unverifiedEntries.length; i++) {
      const e = unverifiedEntries[i];
      try {
        const r = await fetch(`/api/verify/entry/${e.kind}/${e.id}`, { method: 'POST' });
        const j = await r.json();
        if (j.data?.ok) ok++; else fail++;
      } catch { fail++; }
      setBulkProgress({ done: i + 1, total: unverifiedEntries.length, ok, fail });
      await new Promise((res) => setTimeout(res, 250));
    }
    setBulkRunning(false);
    qc.invalidateQueries({ queryKey: ['tools-all-verify'] });
    qc.invalidateQueries({ queryKey: ['owasp-all-verify'] });
    qc.invalidateQueries({ queryKey: ['ai-sec-all-verify'] });
    qc.invalidateQueries({ queryKey: ['compliance-all-verify'] });
    toast.success(`Bulk verify complete: ${ok} ok, ${fail} failed of ${unverifiedEntries.length}`);
  }

  const rows = verifications.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Verification</h1>
          <p className="text-xs text-muted-foreground">
            Secondary verification of knowledge entries and AI claims. The UI never displays VERIFIED unless the backend state is actually VERIFIED.
            States: UNVERIFIED → VERIFYING → VERIFIED | REJECTED | CONFLICT | FAILED | STALE.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={bulkVerify} disabled={bulkRunning || unverifiedEntries.length === 0} size="sm">
            {bulkRunning ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5 mr-2" />}
            {bulkRunning ? `Verifying ${bulkProgress.done}/${bulkProgress.total}…` : `Verify all unverified (${unverifiedEntries.length})`}
          </Button>
          {bulkRunning && (
            <div className="text-[10px] font-mono text-muted-foreground">
              ok: {bulkProgress.ok} · fail: {bulkProgress.fail} · done: {bulkProgress.done}/{bulkProgress.total}
            </div>
          )}
        </div>
      </div>

      {/* Knowledge entries awaiting verification */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Knowledge entry verification</CardTitle>
          <CardDescription className="text-xs">
            Each entry is verified by fetching its official URL (HTTP HEAD/GET) and confirming the source is reachable.
            Seeded entries default to UNVERIFIED. Click "Verify" on an entry, or "Verify all" above to bulk-verify with rate limiting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[40vh]">
            <div className="space-y-1">
              {unverifiedEntries.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">All knowledge entries are VERIFIED.</div>
              ) : unverifiedEntries.slice(0, 200).map((e) => (
                <div key={`${e.kind}-${e.id}`} className="flex items-center gap-2 border-b border-border/30 py-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono">{e.kind}</Badge>
                  <span className="font-mono text-xs flex-1 truncate">{e.name}</span>
                  <a href={e.url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1 font-mono truncate max-w-[300px]">
                    <ExternalLink className="h-2.5 w-2.5" />
                    {(() => { try { return new URL(e.url).host } catch { return e.url.slice(0, 30) } })()}
                  </a>
                  <Button size="sm" variant="outline" onClick={() => verifyEntry(e.kind, e.id, e.name)} className="h-7">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Verify
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent AI verification requests */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> Secondary AI verification requests ({rows.length})</CardTitle>
          <CardDescription className="text-xs">
            Each row is a VerificationRequest from <code className="font-mono">POST /api/verify</code> — the secondary AI workflow
            (Primary → Evidence → Secondary LLM → Compare → Resolve → Store). A timeout never becomes VERIFIED.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No verification requests yet. Use the CVEs view (which supports "Verify this CVE" via the API) or the per-entry Verify buttons above.
            </div>
          ) : (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2">
                {rows.map((v) => (
                  <div key={v.id} className="border-l-2 border-border pl-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatePill state={v.state} />
                      {v.refType && <Badge variant="outline" className="text-[10px] font-mono">{v.refType}{v.refId ? `:${v.refId.slice(-8)}` : ''}</Badge>}
                      {v.disagreementLevel && <Badge variant="outline" className="text-[10px] font-mono text-amber-400 border-amber-500/40">{v.disagreementLevel}</Badge>}
                      {v.agreement !== null && (
                        <Badge variant="outline" className={`text-[10px] font-mono ${v.agreement ? 'text-emerald-400 border-emerald-500/40' : 'text-red-400 border-red-500/40'}`}>
                          {v.agreement ? 'AGREE' : 'DISAGREE'}
                        </Badge>
                      )}
                      {v.durationMs !== null && <span className="text-[10px] text-muted-foreground font-mono ml-auto">{v.durationMs}ms</span>}
                    </div>
                    <div className="font-mono text-[11px] text-foreground/90">{v.claimText}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      <span className="font-mono">Primary ({v.primaryConfidence}):</span> {v.primaryAssessment.slice(0, 200)}
                    </div>
                    {v.secondaryAssessment && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        <span className="font-mono">Secondary:</span> {v.secondaryAssessment.slice(0, 200)}
                      </div>
                    )}
                    {v.reason && <div className="text-[10px] text-amber-400 mt-0.5">⚠ {v.reason}</div>}
                    <div className="text-[10px] text-muted-foreground/70 font-mono mt-1 flex flex-wrap gap-3">
                      <span>primary: {new Date(v.primaryAt).toISOString().slice(0,19)}Z</span>
                      {v.secondaryAt && <span>secondary: {new Date(v.secondaryAt).toISOString().slice(0,19)}Z</span>}
                      <span>evidence: {v.evidence.length}</span>
                      <span>sources: {v.sources.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Help / state legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">State legend</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {Object.entries(STATE_META).filter(([k]) => k !== 'UNKNOWN').map(([k, m]) => (
            <div key={k} className="flex items-center gap-2">
              <StatePill state={k} />
              <span className="text-[10px] text-muted-foreground">
                {k === 'UNVERIFIED' && 'no verification yet (default for seeded entries)'}
                {k === 'VERIFYING' && 'secondary AI dispatched, awaiting response'}
                {k === 'VERIFIED' && 'primary and secondary agree (or URL fetch succeeded for entry verification)'}
                {k === 'REJECTED' && 'secondary disagrees (MINOR)'}
                {k === 'CONFLICT' && 'secondary disagrees (MATERIAL or CRITICAL)'}
                {k === 'FAILED' && 'secondary call failed or timed out — never becomes VERIFIED'}
                {k === 'STALE' && 'verified previously, but evidence has since changed'}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
