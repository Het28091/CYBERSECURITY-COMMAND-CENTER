# KNOWN_RISKS.md

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Single-session scope exceeds time budget | High | Medium | Prioritise P0; P1/P2/P3 are stretch. |
| Docker unavailable in environment | Certain | Low | DockerRunner reports DOCKER_UNAVAILABLE. |
| OSV/NVD rate-limit | Medium | Medium | Cache responses; surface freshness. |
| LLM hallucination | Medium | High | AI output labelled + command-policy gated. |
| Path traversal / symlink escape | Medium | Critical | Canonical-path + allowed-root checks. |
| Secret leakage in logs | Low | Critical | Redaction pipeline. |
| Single-user auth gap | Accepted | Low | Architecture reserves `actor` field. |
