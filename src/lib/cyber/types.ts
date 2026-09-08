// Cybersecurity Command Center — shared types and view identifiers.
// Server + client safe.

export type ViewId =
  | 'command-center'
  | 'projects'
  | 'add-project'
  | 'running'
  | 'findings'
  | 'vulnerabilities'
  | 'cves'
  | 'tools'
  | 'owasp'
  | 'ai-security'
  | 'threat-intel'
  | 'compliance'
  | 'ai-agents'
  | 'automation'
  | 'logs'
  | 'audit'
  | 'system'
  | 'settings'
  | 'project-detail';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string; // lucide icon name
  group: 'Workspace' | 'Security' | 'Governance' | 'System';
  badge?: 'live' | 'count';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'command-center',  label: 'Command Center',     icon: 'LayoutDashboard', group: 'Workspace' },
  { id: 'projects',        label: 'Projects',            icon: 'FolderKanban',    group: 'Workspace', badge: 'count' },
  { id: 'add-project',    label: 'Add Project',         icon: 'PlusCircle',      group: 'Workspace' },
  { id: 'running',         label: 'Running Projects',    icon: 'Activity',        group: 'Workspace', badge: 'live' },
  { id: 'logs',            label: 'Logs',                icon: 'Terminal',        group: 'Workspace' },

  { id: 'findings',        label: 'Security Findings',   icon: 'Bug',             group: 'Security' },
  { id: 'vulnerabilities', label: 'Vulnerabilities',     icon: 'AlertTriangle',  group: 'Security' },
  { id: 'cves',            label: 'CVEs',                icon: 'ShieldAlert',     group: 'Security' },
  { id: 'tools',           label: 'Security Tools',      icon: 'Wrench',          group: 'Security' },
  { id: 'owasp',           label: 'OWASP',               icon: 'Shield',      group: 'Security' },
  { id: 'ai-security',     label: 'AI Security',         icon: 'Bot',             group: 'Security' },
  { id: 'threat-intel',    label: 'Threat Intelligence', icon: 'Radar',           group: 'Security' },

  { id: 'compliance',      label: 'Compliance',          icon: 'Scale',           group: 'Governance' },
  { id: 'audit',           label: 'Audit',               icon: 'ClipboardList',   group: 'Governance' },

  { id: 'ai-agents',       label: 'AI Agents',           icon: 'Users',           group: 'System' },
  { id: 'automation',      label: 'Automation',          icon: 'Workflow',        group: 'System' },
  { id: 'system',          label: 'System',              icon: 'Server',          group: 'System' },
  { id: 'settings',        label: 'Settings',            icon: 'Settings',        group: 'System' },
];

// Status pills and signal helpers — non-colour-only via icons.

export type ProjectStatus =
  | 'REGISTERED' | 'DISCOVERING' | 'DISCOVERED'
  | 'VERIFICATION_PENDING' | 'VERIFIED' | 'VERIFICATION_FAILED'
  | 'STARTING' | 'STARTED' | 'RUNNING' | 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY'
  | 'FAILED' | 'STOPPING' | 'STOPPED' | 'UNKNOWN';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type VerificationStatus =
  | 'UNVERIFIED' | 'VERIFYING' | 'VERIFIED' | 'REJECTED'
  | 'CONFLICT' | 'FAILED' | 'STALE' | 'UNKNOWN';

export type Freshness = 'fresh' | 'stale' | 'unknown';

export type SourceLabel =
  | 'OFFICIAL_SOURCE' | 'SECONDARY_SOURCE' | 'AI_INTERPRETATION' | 'UNVERIFIED' | 'STALE' | 'VERIFIED';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CommandResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface AuditEventRow {
  id: string;
  ts: string;
  actor: string;
  action: string;
  objectType: string;
  objectId: string | null;
  result: 'success' | 'failure';
  reason: string | null;
  metadata: Record<string, unknown>;
}

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  localPath: string;
  language: string | null;
  framework: string | null;
  packageManager: string | null;
  techStack: string[];
  readmePath: string | null;
  entryPoint: string | null;
  runCommand: string | null;
  ports: number[];
  status: ProjectStatus;
  health: HealthStatus;
  verificationStatus: VerificationStatus;
  lastVerificationAt: string | null;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  findingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScannerMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  supported: boolean;
}
