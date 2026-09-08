# AI_AGENT_ARCHITECTURE.md

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Roles

| Role | Objective | Inputs | Outputs | Boundaries |
|------|-----------|--------|---------|------------|
| Architect | Decide module boundaries. | Discovery + README. | Module decisions recorded in DECISIONS.md. | Read-only on filesystem. |
| Research | Look up external info (CVE/OWASP). | A claim or topic. | Sources + freshness. | Read-only network; only OSV/NVD/official OWASP. |
| ProjectExploration | Inspect a registered project. | Project path. | Discovery snapshot. | Read-only filesystem. Never executes. |
| Security | Scan a project. | Project path + scanner set. | Findings. | Read-only filesystem. Never executes. |
| Coding | Suggest run/build commands. | Discovery + README. | Suggested command + evidence. | Never executes; output goes through command policy. |
| Testing | Verify golden path. | App URL. | Pass/fail report. | Browser only. |
| Documentation | Summarise the work. | State files. | Markdown report. | Read-only. |
| Compliance | Map controls. | Project + framework. | Applicability map. | Read-only. |
| Verification | Cross-check claims. | A claim. | Verdict + sources. | Read-only network. |

## 2. Workflow

```
Research → Verify → Design → Implement → Test → Security Review → Fix
→ Regression Test → Document → Accept
```

Every gate is recorded. No agent can skip a gate.

## 3. In This Session

For this single-session build, all roles are played by the main agent. The
`Agents` page in the UI exposes the role catalogue (read-only) for
transparency. A future multi-session implementation will dispatch these
roles to dedicated subagents.
