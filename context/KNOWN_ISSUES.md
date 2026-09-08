# KNOWN_ISSUES.md — Open Issues

Append-only. Newest at top. Closed issues moved to `archive/`.

---

## I-2026-09-08-001 — Docker not installed in environment

- **Impact:** DockerRunner cannot execute. Projects that depend on Docker
  for startup will not run.
- **Mitigation:** Runner reports `DOCKER_UNAVAILABLE` clearly; README
  cross-check still records the presence of a Dockerfile.

## I-2026-09-08-002 — No Go / Rust / Ruby runtimes

- **Impact:** Projects in those languages cannot be run directly.
- **Mitigation:** Runners for those languages are stubbed with a clear
  "RUNTIME NOT INSTALLED" status. Discovery still detects the language.
