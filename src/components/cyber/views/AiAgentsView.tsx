// AI Agents — read-only catalogue of agent roles. (See docs/AI_AGENT_ARCHITECTURE.md.)

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Bot, Cog, Shield, Bug, FileText, Scale, Search, FolderSearch, ShieldCheck } from 'lucide-react';

const ROLES = [
  { name: 'Architect', icon: Cog, objective: 'Decide module boundaries and abstractions.', inputs: 'Discovery + README.', outputs: 'Module decisions recorded in DECISIONS.md.', boundaries: 'Read-only on filesystem.' },
  { name: 'Research', icon: Search, objective: 'Look up external information (CVEs, OWASP, regulations).', inputs: 'A claim or topic.', outputs: 'Sources + freshness labels.', boundaries: 'Read-only network; OSV/NVD/official OWASP only.' },
  { name: 'Project Exploration', icon: FolderSearch, objective: 'Inspect a registered project.', inputs: 'Project path.', outputs: 'Discovery snapshot.', boundaries: 'Read-only filesystem; never executes.' },
  { name: 'Security', icon: ShieldCheck, objective: 'Scan a project with the configured scanners.', inputs: 'Project path + scanner set.', outputs: 'Findings.', boundaries: 'Read-only filesystem; never executes.' },
  { name: 'Coding', icon: Bot, objective: 'Suggest run/build commands.', inputs: 'Discovery + README.', outputs: 'Suggested command + evidence.', boundaries: 'Never executes; output goes through command policy.' },
  { name: 'Testing', icon: Bug, objective: 'Verify the golden path.', inputs: 'App URL.', outputs: 'Pass/fail report.', boundaries: 'Browser only.' },
  { name: 'Documentation', icon: FileText, objective: 'Summarise the work.', inputs: 'State files.', outputs: 'Markdown report.', boundaries: 'Read-only.' },
  { name: 'Compliance', icon: Scale, objective: 'Map controls and applicability.', inputs: 'Project + framework.', outputs: 'Applicability map.', boundaries: 'Read-only.' },
  { name: 'Verification', icon: Shield, objective: 'Cross-check claims.', inputs: 'A claim.', outputs: 'Verdict + sources.', boundaries: 'Read-only network.' },
];

export function AiAgentsView() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI Agents</h1>
        <p className="text-xs text-muted-foreground">Catalogue of specialised agent roles. In this single-session build, all roles are played by the main agent; future multi-session builds can dispatch these to dedicated subagents.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {r.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <div><span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Objective</span><div>{r.objective}</div></div>
                <div><span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Inputs</span><div>{r.inputs}</div></div>
                <div><span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Outputs</span><div>{r.outputs}</div></div>
                <div><span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Boundaries</span><div className="text-amber-300">{r.boundaries}</div></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-3 text-xs flex items-center gap-2"><Users className="h-4 w-4 text-amber-400 shrink-0" /><span className="text-amber-200">Workflow gates: Research → Verify → Design → Implement → Test → Security Review → Fix → Regression Test → Document → Accept. No agent can skip a gate.</span></CardContent>
      </Card>
    </div>
  );
}
