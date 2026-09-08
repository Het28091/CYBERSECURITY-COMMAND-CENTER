# UI_REQUIREMENTS.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Aesthetic

- **Dark-first** (with light theme available via next-themes).
- Cybersecurity-focused visual language:
  - System health rings (not decorative pie charts).
  - Severity colour scale: critical → red, high → orange, medium → amber,
    low → blue, info → slate.
  - Status pills with non-colour-only indicators (icon + label).
  - Monospace for logs, commands, paths, CVE IDs, audit JSON.
- Avoid: generic admin dashboards, fake hacker neon, useless animations,
  fake telemetry.

## 2. Layout

- Root wrapper: `min-h-screen flex flex-col`.
- Top bar: app title + global search + command palette trigger + theme toggle.
- Sidebar (left, 240px, collapsible): all 17 navigation sections grouped.
- Main content: scrollable, max-w-screen-2xl, padded.
- Sticky footer with build / spiral / verification status.

## 3. Navigation Sections (Sidebar)

1. Command Center (dashboard)
2. Projects (registry)
3. Add Project
4. Running Projects
5. Security Findings
6. Vulnerabilities
7. CVEs
8. Security Tools
9. OWASP
10. AI Security
11. Threat Intelligence
12. Compliance
13. AI Agents
14. Automation
15. Logs
16. Audit
17. System
18. Settings

Grouped:
- **Workspace**: Command Center, Projects, Add Project, Running Projects, Logs
- **Security**: Security Findings, Vulnerabilities, CVEs, Security Tools, OWASP, AI Security, Threat Intelligence
- **Governance**: Compliance, Audit
- **System**: AI Agents, Automation, System, Settings

## 4. Components

### Command Center
- KPI tiles: Projects registered, Running, Unhealthy, Findings (last 24h),
  Audit events (last 24h).
- Running projects table with live status.
- Recent audit events list.
- Data source freshness panel (OSV, NVD, OWASP, AI security, compliance).
- "NO DATA AVAILABLE" / "NOT YET CONFIGURED" empty states.

### Project Cards (Registry)
- Name, category, technology badges, status pill, health pill, location
  verification pill, port chips, last run/verification timestamps, security
  findings count, git status (if discoverable).
- Actions: Open, Run, Stop, Restart, Verify, Health Check, View Logs, Scan,
  Edit, Delete.

### Add Project
- Step 1: Path input + path verification (canonical, allowed root, symlink
  check) with `LOCATION VERIFIED` / `LOCATION VERIFICATION FAILED` pill.
- Step 2: Run discovery; show detected language, framework, package manager,
  ports, env vars with confidence + evidence.
- Step 3: Run README intelligence; show inferred commands with cross-check
  results and confidence.
- Step 4: Dry-run; show resolved command; user confirms before execution.
- Step 5: Register project.

### Project Detail
- Tabs: Overview, Discovery, README, Logs, Health, Scans, Findings, Audit.

### Logs
- Tail-style viewer with stream filter (stdout / stderr / event).
- Copy button, search, pause/resume.
- Redacted secrets (masked as `[REDACTED:KEY]`).

### Vulnerability / CVE
- Search bar with ecosystem hint (npm, pypi, maven, etc.).
- Results table: ID, severity, affected, fixed, source, retrieval time,
  freshness pill.
- Detail drawer: description, references, CVSS, source URL.

### Knowledge Center (Tools, OWASP, AI Security)
- Filter by category, search by name.
- Each entry: name, summary, official source link, verification status,
  last-verified date.

### Compliance
- Disclaimer banner on every compliance page.
- Framework selector.
- Control list with applicability selector and evidence upload (text).
- Never show "COMPLIANT" as a state.

### Audit
- Filter by action, object type, time range.
- Read-only table.

### System
- Health probes (DB, FS, WS).
- Data source freshness table.
- Settings form.

## 5. Accessibility

- All interactive elements keyboard reachable.
- Visible focus ring.
- ARIA labels on icon-only buttons.
- Status indicators use icon + colour + label (not colour alone).
- Respect `prefers-reduced-motion`.

## 6. Responsive

- Sidebar collapses to a drawer below `md`.
- Tables become card lists on small screens.
- Command palette full-screen on mobile.
