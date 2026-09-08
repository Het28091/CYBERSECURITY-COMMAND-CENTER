# THREAT_MODEL.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Scope

The Cybersecurity Command Center is a **local-first** application that the
user runs against their own projects on their own machine. The trust
boundary is the local host plus the user's project directories. External
network calls are limited to OSV.dev and NVD for vulnerability lookup.

## 2. Assets

| Asset | Description |
|-------|-------------|
| A-1 Project registry | Metadata about the user's local projects. |
| A-2 Project source code | The user's actual project files (read by the discovery engine). |
| A-3 Project logs | stdout/stderr captured from running projects. |
| A-4 Secrets in project env files | `.env` files of registered projects. |
| A-5 Audit trail | Tamper-evident record of actions. |
| A-6 Cached external data | OSV/NVD responses in `cache/`. |

## 3. Threat Agents

| Agent | Motivation | Capability |
|-------|------------|------------|
| T-1 Malicious project | Escape scope, execute arbitrary code, exfiltrate data. | Writes README/manifest files that the engine parses. |
| T-2 Malicious README | Trick the runner into executing dangerous commands. | Controls README content but not the runner policy. |
| T-3 Compromised dependency | Code execution during project run. | Runs only within the project's own context. |
| T-4 AI hallucination | The LLM infers a non-existent run command. | Constrained by README cross-check + confidence. |
| T-5 Prompt injection via README content | Triggers the LLM to suggest harmful commands. | Constrained by command policy + allow-list. |
| T-6 Local attacker on shared host | Reads SQLite DB or logs. | Out of scope for this local-first single-user build. |
| T-7 Stale data | User acts on outdated CVE/OWASP info. | Mitigated by freshness labels. |
| T-8 Compromised external source | OSV/NVD returns manipulated data. | Mitigated by Tier-1 source pinning + retrieval time. |

## 4. Threats (STRIDE)

### Spoofing

| ID | Threat | Mitigation |
|----|--------|------------|
| S-1 README claims to be official. | Display "UNVERIFIED" until cross-check passes. |
| S-2 AI interpretation presented as official. | UI tags AI content with `AI_INTERPRETATION` label. |

### Tampering

| ID | Threat | Mitigation |
|----|--------|------------|
| T-1 Path traversal in project path. | Canonical path resolution + allowed-root check. |
| T-2 Symlink escape. | `fs.realpath` + check final path stays under allowed root. |
| T-3 Command injection via README. | Allow-list of executables; arguments validated. |
| T-4 Working directory override. | Working dir always derived from project path; never from request body. |
| T-5 Audit tampering. | Audit records are append-only in DB. |

### Repudiation

| ID | Threat | Mitigation |
|----|--------|------------|
| R-1 User denies running a project. | Audit event recorded for every run/stop. |

### Information Disclosure

| ID | Threat | Mitigation |
|----|--------|------------|
| I-1 Secrets in logs. | Regex redaction on every log line. |
| I-2 Secrets in API responses. | Same redaction pipeline. |
| I-3 Exposed management interface. | Default bind is localhost. |
| I-4 External network exposure. | Caddy only exposes :81 → :3000 / :3003. |

### Denial of Service

| ID | Threat | Mitigation |
|----|--------|------------|
| D-1 Project hangs. | Per-command timeout + force-kill on shutdown. |
| D-2 Orphan processes. | On runner shutdown, kill tracked children. |
| D-3 Log explosion. | Cap per-project log lines, rotate. |

### Elevation of Privilege

| ID | Threat | Mitigation |
|----|--------|------------|
| E-1 Runner executes `sudo`. | `sudo` is in block-list. |
| E-2 Runner executes shell meta-commands (`;`, `&&`, `` ` ``). | Arguments are passed as `argv`, never via shell string. |

## 5. Top Risks (Ranked)

1. **Malicious README → unsafe command execution.** Mitigated by allow-list
   + dry-run + cross-check.
2. **Path traversal / symlink escape.** Mitigated by canonical-path enforcement
   + allowed roots.
3. **AI hallucination of run commands.** Mitigated by confidence + evidence +
   cross-check; AI-only inferences start at LOW confidence.
4. **Secret leakage in logs.** Mitigated by redaction pipeline.
5. **Stale vulnerability data treated as current.** Mitigated by freshness
   labels and retrieval time.

## 6. Out of Scope

- Multi-user authentication and privilege escalation between users.
- Defense against a fully compromised host.
- Tamper protection against an attacker with write access to the SQLite DB
  file (the audit trail is append-only in app code, not cryptographically
  signed).

## 7. Review Cadence

Threat model is reviewed at the start of every spiral. Disagreements with
the previous model are recorded in `context/DECISIONS.md`.
