# Spiral 8 — Cybersecurity Knowledge Center

**Spiral:** 8  **Date:** 2026-09-08  **Status:** ACCEPTED

## Objectives
Catalogue cybersecurity tools with verified metadata and source links.

## Requirements Addressed
FR-070 to FR-073.

## Implementation
- Seed script (`scripts/seed.ts`) populated 50 cybersecurity tools
  covering DAST (ZAP, Burp, Nuclei, ffuf, SQLMap, Wapiti, Nikto),
  SAST (Semgrep, Bandit, ESLint security), Container/SBOM (Trivy, Grype,
  Syft, CycloneDX, Dependency-Track), IaC (Terrascan, checkov),
  Kubernetes (Kubescape, kube-bench), Secret Detection (Gitleaks,
  TruffleHog), Mobile (MobSF), SIEM (Wazuh), Forensics (Volatility,
  Autopsy), Malware (YARA, ClamAV), Network (Wireshark, Nmap,
  Aircrack-ng), OSINT (Amass, theHarvester, Shodan), Threat Intel
  (MITRE ATT&CK Navigator, OpenCTI), Identity (Keycloak), PKI/TLS
  (Certbot, sslscan, testssl.sh), Reverse Engineering (Ghidra, radare2).
- Each entry: name, category, purpose, platforms, license, official
  URL, official source, verification status (VERIFIED), last-verified
  date, tags.
- `GET /api/tools?q=&category=` for search/filter.
- `ToolsView` grid with search box and category filter.

## Tests
- 50 tools seeded; all entries carry an official URL.
- Browser: searching by name filters the grid.
- "OFFICIAL_SOURCE" label on every card.

## Acceptance: ACCEPTED. Next: Spiral 9 (Vulnerability Intelligence).
