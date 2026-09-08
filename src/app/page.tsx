// Cybersecurity Command Center — main page (single-page app).
// Per platform skill, the user sees only the `/` route. All 17+ sections
// render as views inside this page, switched by the Zustand store.

'use client';

import { Sidebar } from '@/components/cyber/Sidebar';
import { TopBar } from '@/components/cyber/TopBar';
import { CommandPalette } from '@/components/cyber/CommandPalette';
import { GlobalSearch } from '@/components/cyber/GlobalSearch';
import { useAppStore } from '@/stores/app';
import { useProcWs } from '@/hooks/useProcWs';
import { CommandCenterView } from '@/components/cyber/views/CommandCenterView';
import { ProjectsView } from '@/components/cyber/views/ProjectsView';
import { AddProjectView } from '@/components/cyber/views/AddProjectView';
import { RunningProjectsView } from '@/components/cyber/views/RunningProjectsView';
import { LogsView } from '@/components/cyber/views/LogsView';
import { FindingsView } from '@/components/cyber/views/FindingsView';
import { VulnerabilitiesView } from '@/components/cyber/views/VulnerabilitiesView';
import { CvesView } from '@/components/cyber/views/CvesView';
import { ToolsView } from '@/components/cyber/views/ToolsView';
import { OwaspView } from '@/components/cyber/views/OwaspView';
import { AiSecurityView } from '@/components/cyber/views/AiSecurityView';
import { ThreatIntelView } from '@/components/cyber/views/ThreatIntelView';
import { ComplianceView } from '@/components/cyber/views/ComplianceView';
import { AiAgentsView } from '@/components/cyber/views/AiAgentsView';
import { AutomationView } from '@/components/cyber/views/AutomationView';
import { AuditView } from '@/components/cyber/views/AuditView';
import { SystemView } from '@/components/cyber/views/SystemView';
import { SettingsView } from '@/components/cyber/views/SettingsView';
import { ProjectDetailView } from '@/components/cyber/views/ProjectDetailView';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { useState, useEffect } from 'react';

export default function Page() {
  const view = useAppStore((s) => s.view);
  // Subscribe to global WebSocket events so the dashboard "live" indicator can react.
  useProcWs();

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen flex flex-col bg-background cyber-grid-bg">
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar />
              <main className="flex-1 overflow-y-auto cyber-scroll p-4 md:p-6">
                <ViewRouter view={view} />
              </main>
              <Footer />
            </div>
          </div>
          <CommandPalette />
          <GlobalSearch />
          <Toaster richColors position="bottom-right" />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// Single shared QueryClient (avoid re-creating on every render).
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function ViewRouter({ view }: { view: string }) {
  switch (view) {
    case 'command-center': return <CommandCenterView />;
    case 'projects': return <ProjectsView />;
    case 'add-project': return <AddProjectView />;
    case 'running': return <RunningProjectsView />;
    case 'logs': return <LogsView />;
    case 'findings': return <FindingsView />;
    case 'vulnerabilities': return <VulnerabilitiesView />;
    case 'cves': return <CvesView />;
    case 'tools': return <ToolsView />;
    case 'owasp': return <OwaspView />;
    case 'ai-security': return <AiSecurityView />;
    case 'threat-intel': return <ThreatIntelView />;
    case 'compliance': return <ComplianceView />;
    case 'ai-agents': return <AiAgentsView />;
    case 'automation': return <AutomationView />;
    case 'audit': return <AuditView />;
    case 'system': return <SystemView />;
    case 'settings': return <SettingsView />;
    case 'project-detail': return <ProjectDetailView />;
    default: return <div className="text-xs text-muted-foreground">Unknown view: {view}</div>;
  }
}

function Footer() {
  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className="h-8 border-t bg-background/80 px-4 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
      <div>CYBERSECURITY COMMAND CENTER · SPIRAL 0-12 · LOCAL-FIRST · EVIDENCE-BASED</div>
      <div>{now}</div>
    </footer>
  );
}
