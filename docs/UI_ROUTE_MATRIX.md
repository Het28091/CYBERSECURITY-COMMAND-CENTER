# UI Route Matrix — Cybersecurity Command Center

**Audit date:** 2026-09-09
**Total views:** 21 (19 nav + login + project-detail)
**All browser-tested:** YES
**Console errors:** 0 across all views
**Page errors:** 0 across all views

---

## Full Route Matrix

| # | View | Loads | Browser Tested | Console Errors | Page Errors | Overlap Issues | Z-index Issues | Responsive Issues | Accessibility | Screenshot |
|---|------|-------|---------------|---------------|-------------|----------------|---------------|-------------------|---------------|-----------|
| 00 | Login | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | 00-login.png |
| 01 | Command Center | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | command-center.png, command-center-3d.png |
| 02 | Projects | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | projects.png |
| 03 | Add Project | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA, Forms | add-project.png |
| 04 | Running Projects | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | running.png |
| 05 | Logs | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | logs.png |
| 06 | Security Findings | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | findings.png |
| 07 | Vulnerabilities | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | vulnerabilities.png |
| 08 | CVEs | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA, Forms | cves.png |
| 09 | Security Tools | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | tools.png |
| 10 | OWASP | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | owasp.png |
| 11 | AI Security | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | ai-security.png |
| 12 | Threat Intelligence | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | threat-intel.png |
| 13 | Compliance | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA, Forms | compliance.png |
| 14 | Verification | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA, Buttons | verification.png |
| 15 | AI Agents | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | ai-agents.png |
| 16 | Automation | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | automation.png |
| 17 | Audit | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | audit.png |
| 18 | System | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA | system.png |
| 19 | Settings | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA, Forms | settings.png |
| 20 | Project Detail | ✓ | ✓ | 0 | 0 | 0 | 0 | OK | Keyboard, ARIA, Tabs | project-detail.png |

## Summary

- **Total views tested:** 21
- **All views load successfully:** YES
- **Total console errors:** 0
- **Total page errors:** 0
- **Total overlap issues:** 0
- **Total z-index issues:** 0
- **Total responsive issues:** 0 (responsive classes tested; mobile/tablet via CSS breakpoints)
- **3D topology (WebGL canvas):** Present on Command Center (1 canvas element confirmed)
- **3D fallback:** 2D grid fallback when WebGL unavailable or reduced-motion active

## 3D Cybersecurity Topology

- **Implementation:** Three.js via @react-three/fiber + @react-three/drei
- **Location:** Command Center dashboard
- **Features:**
  - Project nodes positioned on a sphere formation
  - Node colors: green (running), red (failed/unhealthy), gray (stopped), amber (degraded), blue (default)
  - Dependency edges (lines between nearby nodes)
  - Floating animation (subtle, reduced-motion respected)
  - Orbit controls (rotate, zoom)
  - Click nodes to open project detail
  - Auto-rotation (disabled when reduced-motion)
- **Fallback:** 2D grid of project cards with color-coded status dots
- **Performance:** Capped at 30 nodes for rendering; dpr [1, 1.5]
