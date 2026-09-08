// Seed script: populates the knowledge base and compliance catalogue.
// Run with: `bun run scripts/seed.ts`
// Idempotent — re-running skips already-existing entries by `code`/`name`+`list`.

import { db } from '../src/lib/db';

async function main() {
  console.log('Seeding Cybersecurity Command Center knowledge base...');

  // ── Settings ───────────────────────────────────────────────────────────────
  const existingSettings = await db.settings.findUnique({ where: { id: 1 } }).catch(() => null);
  if (!existingSettings) {
    await db.settings.create({
      data: {
        id: 1,
        allowedProjectRoots: JSON.stringify(['/home/z/my-project', '/tmp']),
        typoCorrection: true,
        bindLocalhost: true,
        maxLogLinesPerProject: 5000,
        commandTimeoutMs: 60000,
        externalFetchEnabled: true,
        aiAssistanceEnabled: true,
      },
    });
    console.log('  Settings seeded');
  } else {
    console.log('  Settings already present');
  }

  // ── Data Sources ────────────────────────────────────────────────────────────
  const sources = [
    { code: 'osv',  name: 'OSV.dev', endpoint: 'https://api.osv.dev/v1/query' },
    { code: 'nvd',  name: 'NVD',    endpoint: 'https://services.nvd.nist.gov/rest/json/cves/2.0' },
    { code: 'owasp-web-2021',  name: 'OWASP Top 10 Web 2021',  endpoint: 'https://owasp.org/Top10/' },
    { code: 'owasp-api-2023',  name: 'OWASP API Top 10 2023',  endpoint: 'https://owasp.org/API-Security/' },
    { code: 'owasp-llm-2025',  name: 'OWASP Top 10 LLM 2025',  endpoint: 'https://genai.owasp.org/' },
    { code: 'gdpr', name: 'GDPR',  endpoint: 'https://gdpr.eu/' },
    { code: 'nis2', name: 'NIS2',  endpoint: 'https://digital-strategy.ec.europa.eu/en/policies/nis2-directive' },
    { code: 'cra',  name: 'Cyber Resilience Act', endpoint: 'https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act' },
    { code: 'dora', name: 'DORA',  endpoint: 'https://digital-finance-2025.europa.eu/' },
    { code: 'eu-ai-act', name: 'EU AI Act', endpoint: 'https://artificialintelligenceact.eu/' },
  ];
  for (const s of sources) {
    await db.dataSource.upsert({
      where: { code: s.code },
      update: {},
      create: { ...s, trustTier: 1, freshness: 'unknown' },
    });
  }
  console.log(`  DataSources: ${sources.length} upserted`);

  // ── Security Tools ────────────────────────────────────────────────────────
  const tools = [
    { name: 'OWASP ZAP', category: 'DAST', purpose: 'Free web app security scanner', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://www.zaproxy.org/', officialSource: 'https://www.zaproxy.org/', tags: ['web','dast','free'] },
    { name: 'Burp Suite Community', category: 'DAST', purpose: 'Web vulnerability scanner and proxy', platforms: ['Linux','macOS','Windows'], license: 'Freemium', officialUrl: 'https://portswigger.net/burp', officialSource: 'https://portswigger.net/burp', tags: ['web','dast','proxy'] },
    { name: 'Nikto', category: 'DAST', purpose: 'Web server scanner', platforms: ['Linux'], license: 'GPL', officialUrl: 'https://github.com/sullo/nikto', officialSource: 'https://github.com/sullo/nikto', tags: ['web','dast','free'] },
    { name: 'Nuclei', category: 'DAST', purpose: 'Template-based vulnerability scanner', platforms: ['Linux','macOS','Windows'], license: 'MIT', officialUrl: 'https://github.com/projectdiscovery/nuclei', officialSource: 'https://github.com/projectdiscovery/nuclei', tags: ['web','dast','templates'] },
    { name: 'ffuf', category: 'Web Fuzzing', purpose: 'Fast web fuzzer', platforms: ['Linux','macOS','Windows'], license: 'MIT', officialUrl: 'https://github.com/ffuf/ffuf', officialSource: 'https://github.com/ffuf/ffuf', tags: ['web','fuzzing'] },
    { name: 'SQLMap', category: 'DAST', purpose: 'Automatic SQL injection and database takeover tool', platforms: ['Linux','macOS','Windows'], license: 'GPL', officialUrl: 'https://github.com/sqlmapproject/sqlmap', officialSource: 'https://github.com/sqlmapproject/sqlmap', tags: ['sqli','dast'] },
    { name: 'Trivy', category: 'Container/Config', purpose: 'Vulnerability and misconfiguration scanner for containers, IaC, repos', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/aquasecurity/trivy', officialSource: 'https://github.com/aquasecurity/trivy', tags: ['container','sbom','iac','secret'] },
    { name: 'Grype', category: 'Container', purpose: 'Vulnerability scanner for container images and filesystems', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/anchore/grype', officialSource: 'https://github.com/anchore/grype', tags: ['container','sbom'] },
    { name: 'Syft', category: 'SBOM', purpose: 'Generate SBOM from container images and filesystems', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/anchore/syft', officialSource: 'https://github.com/anchore/syft', tags: ['sbom'] },
    { name: 'Semgrep', category: 'SAST', purpose: 'Static analysis at ludicrous speed', platforms: ['Linux','macOS','Windows'], license: 'LGPL-2.1', officialUrl: 'https://semgrep.dev/', officialSource: 'https://github.com/returntocorp/semgrep', tags: ['sast','code'] },
    { name: 'Bandit', category: 'SAST', purpose: 'Python source code security analyzer', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/PyCQA/bandit', officialSource: 'https://github.com/PyCQA/bandit', tags: ['python','sast'] },
    { name: 'ESLint security plugin', category: 'SAST', purpose: 'Linting rules for JavaScript security', platforms: ['Linux','macOS','Windows'], license: 'MIT', officialUrl: 'https://github.com/eslint-community/eslint-plugin-security', officialSource: 'https://github.com/eslint-community/eslint-plugin-security', tags: ['javascript','sast'] },
    { name: 'Gitleaks', category: 'Secret Detection', purpose: 'Detect and prevent secrets in repos', platforms: ['Linux','macOS','Windows'], license: 'MIT', officialUrl: 'https://github.com/gitleaks/gitleaks', officialSource: 'https://github.com/gitleaks/gitleaks', tags: ['secret','git'] },
    { name: 'TruffleHog', category: 'Secret Detection', purpose: 'Find and verify credentials in code', platforms: ['Linux','macOS','Windows'], license: 'AGPL-3.0', officialUrl: 'https://github.com/trufflesecurity/trufflehog', officialSource: 'https://github.com/trufflesecurity/trufflehog', tags: ['secret','git'] },
    { name: 'Kubescape', category: 'Kubernetes', purpose: 'Kubernetes misconfiguration and vulnerability scanner', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/kubescape/kubescape', officialSource: 'https://github.com/kubescape/kubescape', tags: ['k8s','security'] },
    { name: 'kube-bench', category: 'Kubernetes', purpose: 'CIS Kubernetes Benchmark scanner', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/aquasecurity/kube-bench', officialSource: 'https://github.com/aquasecurity/kube-bench', tags: ['k8s','cis'] },
    { name: 'Terrascan', category: 'IaC', purpose: 'IaC misconfiguration scanner (Terraform, K8s, Helm)', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/tenable/terrascan', officialSource: 'https://github.com/tenable/terrascan', tags: ['iac','terraform'] },
    { name: 'checkov', category: 'IaC', purpose: 'Cloud misconfiguration scanner (Terraform, CFN, K8s, etc.)', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/bridgecrewio/checkov', officialSource: 'https://github.com/bridgecrewio/checkov', tags: ['iac','terraform'] },
    { name: 'Wapiti', category: 'DAST', purpose: 'Web application vulnerability scanner', platforms: ['Linux','macOS','Windows'], license: 'GPL', officialUrl: 'https://github.com/wapiti-scanner/wapiti', officialSource: 'https://github.com/wapiti-scanner/wapiti', tags: ['web','dast'] },
    { name: 'MobSF', category: 'Mobile', purpose: 'Mobile Security Framework for Android/iOS', platforms: ['Linux','macOS','Windows'], license: 'GPL-3.0', officialUrl: 'https://github.com/MobSF/Mobile-Security-Framework-MobSF', officialSource: 'https://github.com/MobSF/Mobile-Security-Framework-MobSF', tags: ['mobile','android','ios'] },
    { name: 'Dependency-Check', category: 'Dependency', purpose: 'OWASP dependency-check (SCA)', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/jeremylong/DependencyCheck', officialSource: 'https://github.com/jeremylong/DependencyCheck', tags: ['sca','dependency'] },
    { name: 'CycloneDX', category: 'SBOM', purpose: 'CycloneDX SBOM standard and tooling', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://cyclonedx.org/', officialSource: 'https://cyclonedx.org/', tags: ['sbom','standard'] },
    { name: 'Sigstore/cosign', category: 'Supply Chain', purpose: 'Sign and verify container images and artifacts', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://github.com/sigstore/cosign', officialSource: 'https://github.com/sigstore/cosign', tags: ['supply-chain','signing'] },
    { name: 'in-toto', category: 'Supply Chain', purpose: 'Software supply chain attestation framework', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://in-toto.io/', officialSource: 'https://in-toto.io/', tags: ['supply-chain','attestation'] },
    { name: 'Wazuh', category: 'SIEM', purpose: 'Open source SIEM and XDR', platforms: ['Linux'], license: 'GPL-2.0', officialUrl: 'https://wazuh.com/', officialSource: 'https://wazuh.com/', tags: ['siem','xdr'] },
    { name: 'OSSEC', category: 'HIDS', purpose: 'Host-based intrusion detection', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://www.ossec.io/', officialSource: 'https://www.ossec.io/', tags: ['hids','file-integrity'] },
    { name: 'Falco', category: 'Cloud Runtime', purpose: 'Cloud-native runtime security', platforms: ['Linux'], license: 'Apache-2.0', officialUrl: 'https://falco.org/', officialSource: 'https://github.com/falcosecurity/falco', tags: ['runtime','k8s'] },
    { name: 'Wireshark', category: 'Network', purpose: 'Network protocol analyzer', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://www.wireshark.org/', officialSource: 'https://www.wireshark.org/', tags: ['network','pcap'] },
    { name: 'Nmap', category: 'Network', purpose: 'Network discovery and security auditing', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://nmap.org/', officialSource: 'https://nmap.org/', tags: ['network','scan'] },
    { name: 'Aircrack-ng', category: 'Wireless', purpose: 'WiFi security auditing suite', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://www.aircrack-ng.org/', officialSource: 'https://www.aircrack-ng.org/', tags: ['wireless','wifi'] },
    { name: 'Volatility', category: 'Forensics', purpose: 'Memory forensics framework', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://github.com/volatilityfoundation/volatility3', officialSource: 'https://github.com/volatilityfoundation/volatility3', tags: ['memory','forensics'] },
    { name: 'Autopsy', category: 'Forensics', purpose: 'Digital forensics platform', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://www.sleuthkit.org/autopsy/', officialSource: 'https://www.sleuthkit.org/autopsy/', tags: ['disk','forensics'] },
    { name: 'YARA', category: 'Malware', purpose: 'Pattern matching for malware researchers', platforms: ['Linux','macOS','Windows'], license: 'BSD-3-Clause', officialUrl: 'https://virustotal.github.io/yara/', officialSource: 'https://github.com/VirusTotal/yara', tags: ['malware','signatures'] },
    { name: 'ClamAV', category: 'Malware', purpose: 'Open source antivirus engine', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://www.clamav.net/', officialSource: 'https://www.clamav.net/', tags: ['malware','av'] },
    { name: 'HashiCorp Vault', category: 'Secrets Management', purpose: 'Secrets management and encryption', platforms: ['Linux','macOS','Windows'], license: 'BUSL-1.1', officialUrl: 'https://www.vaultproject.io/', officialSource: 'https://www.vaultproject.io/', tags: ['secret-mgmt','encryption'] },
    { name: 'OpenVAS / Greenbone', category: 'VA', purpose: 'Open vulnerability assessment', platforms: ['Linux'], license: 'GPL-2.0', officialUrl: 'https://www.greenbone.net/', officialSource: 'https://github.com/greenbone/openvas-scanner', tags: ['va','network'] },
    { name: 'Certbot', category: 'PKI/TLS', purpose: 'Automatically enable HTTPS (Let’s Encrypt)', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://certbot.eff.org/', officialSource: 'https://github.com/certbot/certbot', tags: ['tls','lets-encrypt'] },
    { name: 'sslscan', category: 'PKI/TLS', purpose: 'SSL/TLS scanner', platforms: ['Linux','macOS','Windows'], license: 'GPL-3.0', officialUrl: 'https://github.com/rbsec/sslscan', officialSource: 'https://github.com/rbsec/sslscan', tags: ['tls','scan'] },
    { name: 'testssl.sh', category: 'PKI/TLS', purpose: 'TLS testing tool', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://testssl.sh/', officialSource: 'https://github.com/drwetter/testssl.sh', tags: ['tls','scan'] },
    { name: 'Ghidra', category: 'Reverse Engineering', purpose: 'Reverse engineering suite (NSA)', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://ghidra-sre.org/', officialSource: 'https://github.com/NationalSecurityAgency/ghidra', tags: ['re','binary'] },
    { name: 'radare2', category: 'Reverse Engineering', purpose: 'Reverse engineering framework', platforms: ['Linux','macOS','Windows'], license: 'LGPL-3.0', officialUrl: 'https://www.radare.org/', officialSource: 'https://github.com/radareorg/radare2', tags: ['re','binary'] },
    { name: 'OWASP Amass', category: 'OSINT', purpose: 'Attack surface mapping', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://owasp.org/www-project-amass/', officialSource: 'https://github.com/owasp-amass/amass', tags: ['osint','asset'] },
    { name: 'theHarvester', category: 'OSINT', purpose: 'Emails, subdomains, hosts harvester', platforms: ['Linux','macOS','Windows'], license: 'GPL-2.0', officialUrl: 'https://github.com/laramies/theHarvester', officialSource: 'https://github.com/laramies/theHarvester', tags: ['osint'] },
    { name: 'Shodan', category: 'OSINT', purpose: 'Search engine for Internet-connected devices', platforms: ['Linux','macOS','Windows'], license: 'Commercial + free tier', officialUrl: 'https://www.shodan.io/', officialSource: 'https://www.shodan.io/', tags: ['osint','iot'] },
    { name: 'MITRE ATT&CK Navigator', category: 'Threat Intel', purpose: 'Navigate and visualise ATT&CK', platforms: ['Web'], license: 'Apache-2.0', officialUrl: 'https://mitre-attack.github.io/attack-navigator/', officialSource: 'https://github.com/mitre-attack/attack-navigator', tags: ['attack','threat'] },
    { name: 'OpenCTI', category: 'Threat Intel', purpose: 'Open source threat intelligence platform', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://www.opencti.io/', officialSource: 'https://github.com/OpenCTI-Platform/opencti', tags: ['threat-intel','platform'] },
    { name: 'Keycloak', category: 'Identity', purpose: 'Open source identity and access management', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://www.keycloak.org/', officialSource: 'https://www.keycloak.org/', tags: ['iam','sso'] },
    { name: 'OWASP CycloneDX Tool Center', category: 'SBOM', purpose: 'Tooling around CycloneDX SBOMs', platforms: ['Web'], license: 'Apache-2.0', officialUrl: 'https://cyclonedx.org/tool-center/', officialSource: 'https://cyclonedx.org/tool-center/', tags: ['sbom'] },
    { name: 'OWASP Dependency-Track', category: 'SCA', purpose: 'SBOM analysis platform', platforms: ['Linux','macOS','Windows'], license: 'Apache-2.0', officialUrl: 'https://dependencytrack.org/', officialSource: 'https://github.com/DependencyTrack/dependency-track', tags: ['sca','sbom'] },
    { name: 'Terraform', category: 'IaC', purpose: 'IaC provisioning tool (with security caveats)', platforms: ['Linux','macOS','Windows'], license: 'MPL-2.0', officialUrl: 'https://www.terraform.io/', officialSource: 'https://www.terraform.io/', tags: ['iac'] },
  ];
  for (const t of tools) {
    const found = await db.securityTool.findFirst({ where: { name: t.name } });
    if (!found) {
      await db.securityTool.create({
        data: {
          name: t.name, category: t.category, purpose: t.purpose,
          platforms: JSON.stringify(t.platforms), license: t.license ?? null,
          officialUrl: t.officialUrl, officialSource: t.officialSource,
          verificationStatus: 'VERIFIED', lastVerifiedAt: new Date(),
          tags: JSON.stringify(t.tags ?? []),
        },
      });
    }
  }
  console.log(`  SecurityTools: ${tools.length} ensured`);

  // ── OWASP entries ──────────────────────────────────────────────────────────
  const owasp = [
    // OWASP Top 10 Web 2021
    { list: 'web-2021', rank: 'A01', name: 'Broken Access Control', summary: 'Restrictions on what authenticated users can do are not properly enforced.', mitigations: ['Deny by default', 'Enforce server-side access controls', 'Invalidate state-changing tokens after login'], officialUrl: 'https://owasp.org/Top10/A01_2021-Broken_Access_Control/' },
    { list: 'web-2021', rank: 'A02', name: 'Cryptographic Failures', summary: 'Failures related to cryptography that often lead to exposure of sensitive data.', mitigations: ['Classify data; encrypt sensitive data in transit and at rest', 'Use modern algorithms and protocols', 'Do not write custom crypto'], officialUrl: 'https://owasp.org/Top10/A02_2021-Cryptographic_Failures/' },
    { list: 'web-2021', rank: 'A03', name: 'Injection', summary: 'User-supplied data is not validated, filtered, or sanitised (SQLi, NoSQLi, XSS, etc.).', mitigations: ['Use safe APIs with parameterised queries', 'Use ORMs/parameter binding', 'Positive server-side input validation'], officialUrl: 'https://owasp.org/Top10/A03_2021-Injection/' },
    { list: 'web-2021', rank: 'A04', name: 'Insecure Design', summary: 'Missing or ineffective control design.', mitigations: ['Threat model', 'Use secure design patterns', 'Integrate security into design phase'], officialUrl: 'https://owasp.org/Top10/A04_2021-Insecure_Design/' },
    { list: 'web-2021', rank: 'A05', name: 'Security Misconfiguration', summary: 'Missing hardening, default accounts, verbose error messages.', mitigations: ['Hardened build process', 'Disable unused features', 'Repeatable hardening process'], officialUrl: 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/' },
    { list: 'web-2021', rank: 'A06', name: 'Vulnerable and Outdated Components', summary: 'Using components with known vulnerabilities.', mitigations: ['Inventory dependencies (SBOM)', 'Remove unused dependencies', 'Continuously monitor CVEs'], officialUrl: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/' },
    { list: 'web-2021', rank: 'A07', name: 'Identification and Authentication Failures', summary: 'Weak credential, session, or identity handling.', mitigations: ['Implement MFA', 'Rotate session tokens', 'Validate credentials securely'], officialUrl: 'https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/' },
    { list: 'web-2021', rank: 'A08', name: 'Software and Data Integrity Failures', summary: 'Trusting software, libraries, or data without verifying integrity.', mitigations: ['Signed releases', 'CI/CD pipeline integrity', 'Verify integrity of dependencies'], officialUrl: 'https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/' },
    { list: 'web-2021', rank: 'A09', name: 'Security Logging and Monitoring Failures', summary: 'Insufficient logging, monitoring, and alerting.', mitigations: ['Log all security-relevant events', 'Establish incident response', 'Monitor for anomalies'], officialUrl: 'https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/' },
    { list: 'web-2021', rank: 'A10', name: 'Server-Side Request Forgery (SSRF)', summary: 'Server fetches a remote resource without validating the user-supplied URL.', mitigations: ['Allow-list of remote origins', 'Disable HTTP redirects', 'Segment remote fetch functionality'], officialUrl: 'https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/' },

    // OWASP API Top 10 2023
    { list: 'api-2023', rank: 'API1', name: 'Broken Object Level Authorization (BOLA)', summary: 'API exposes object references without authorisation checks.', mitigations: ['Per-object authorisation', 'Use random IDs but still check authz'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/' },
    { list: 'api-2023', rank: 'API2', name: 'Broken Authentication', summary: 'Auth mechanisms are implemented incorrectly.', mitigations: ['Use standard auth protocols', 'MFA', 'Token rotation'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/' },
    { list: 'api-2023', rank: 'API3', name: 'Broken Object Property Level Authorization', summary: 'APIs expose more properties than necessary (mass assignment, excessive exposure).', mitigations: ['Schema-based input validation', 'Use allow-lists for mass assignment'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/' },
    { list: 'api-2023', rank: 'API4', name: 'Unrestricted Resource Consumption', summary: 'APIs do not limit resource consumption (DoS).', mitigations: ['Rate limiting', 'Quota by IP/user', 'Limit payload size'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/' },
    { list: 'api-2023', rank: 'API5', name: 'Broken Function Level Authorization', summary: 'Administrative functions are exposed to regular users.', mitigations: ['Default deny', 'Function-level authz checks'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/' },
    { list: 'api-2023', rank: 'API6', name: 'Unrestricted Access to Sensitive Business Flows', summary: 'APIs expose business flows without rate/abuse limits.', mitigations: ['Anti-automation controls', 'Business-flow rate limits'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/' },
    { list: 'api-2023', rank: 'API7', name: 'Server Side Request Forgery', summary: 'API fetches remote resources without validating the URL.', mitigations: ['Allow-list of remote origins', 'Disable redirects'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/' },
    { list: 'api-2023', rank: 'API8', name: 'Security Misconfiguration', summary: 'APIs misconfigured (CORS, headers, errors).', mitigations: ['Hardened build process', 'CORS allow-list', 'Disable default creds'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/' },
    { list: 'api-2023', rank: 'API9', name: 'Improper Inventory Management', summary: 'APIs and versions are not inventoried.', mitigations: ['API inventory', 'Versioning policy', 'Documentation'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/' },
    { list: 'api-2023', rank: 'API10', name: 'Unsafe Consumption of APIs', summary: 'Trusting third-party APIs without verification.', mitigations: ['Validate schemas', 'Use strict TLS', 'Allow-list endpoints'], officialUrl: 'https://owasp.org/API-Security/editions/2023/en/0xa10-unsafe-consumption-of-apis/' },

    // OWASP Top 10 LLM 2025 (representative entries)
    { list: 'llm-2025', rank: 'LLM01', name: 'Prompt Injection', summary: 'Adversarial input manipulates the model to produce unintended behaviour.', mitigations: ['Strict input validation', 'Privilege separation between model and tools', 'Human-in-the-loop for sensitive actions'], officialUrl: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/' },
    { list: 'llm-2025', rank: 'LLM02', name: 'Sensitive Information Disclosure', summary: 'LLM reveals sensitive data in responses.', mitigations: ['Data minimisation in prompts', 'Output filtering', 'DLP for LLMs'], officialUrl: 'https://genai.owasp.org/llmrisk/llm02-sensitive-information-disclosure/' },
    { list: 'llm-2025', rank: 'LLM03', name: 'Supply Chain', summary: 'Vulnerable components (model, data, libs) compromise the LLM app.', mitigations: ['SBOM for models', 'Vendor security review', 'Model signing'], officialUrl: 'https://genai.owasp.org/llmrisk/llm03-supply-chain-vulnerabilities/' },
    { list: 'llm-2025', rank: 'LLM04', name: 'Data and Model Poisoning', summary: 'Training or fine-tuning data is tampered with.', mitigations: ['Verify data provenance', 'Statistical anomaly detection', 'Model cards'], officialUrl: 'https://genai.owasp.org/llmrisk/llm04-data-and-model-poisoning/' },
    { list: 'llm-2025', rank: 'LLM05', name: 'Improper Output Handling', summary: 'LLM output is consumed without validation (XSS, SSRF, RCE downstream).', mitigations: ['Treat LLM output as untrusted input', 'Encode before rendering', 'Strict type handling'], officialUrl: 'https://genai.owasp.org/llmrisk/llm05-improper-output-handling/' },
    { list: 'llm-2025', rank: 'LLM06', name: 'Excessive Agency', summary: 'LLM tools have too much authority and act without confirmation.', mitigations: ['Allow-list of tool actions', 'Per-action authorisation', 'Human approval for state-changing actions'], officialUrl: 'https://genai.owasp.org/llmrisk/llm06-excessive-agency/' },
    { list: 'llm-2025', rank: 'LLM07', name: 'System Prompt Leakage', summary: 'System prompts leak sensitive instructions.', mitigations: ['Do not store secrets in system prompts', 'Filter output', 'Treat prompts as code'], officialUrl: 'https://genai.owasp.org/llmrisk/llm07-system-prompt-leakage/' },
    { list: 'llm-2025', rank: 'LLM08', name: 'Vector and Embedding Weaknesses', summary: 'Insecure RAG vector stores and embeddings.', mitigations: ['Access controls on vector store', 'Sanitise retrieved content', 'Restrict data sources'], officialUrl: 'https://genai.owasp.org/llmrisk/llm08-vector-and-embedding-weaknesses/' },
    { list: 'llm-2025', rank: 'LLM09', name: 'Misinformation', summary: 'Hallucinated or misleading content.', mitigations: ['Source citations', 'Confidence thresholds', 'Human review for critical outputs'], officialUrl: 'https://genai.owasp.org/llmrisk/llm09-misinformation/' },
    { list: 'llm-2025', rank: 'LLM10', name: 'Unbounded Consumption', summary: 'LLM resource use is unbounded (DoS, cost).', mitigations: ['Rate limiting', 'Cost caps', 'Request size limits'], officialUrl: 'https://genai.owasp.org/llmrisk/llm10-unbounded-consumption/' },
  ];
  for (const o of owasp) {
    const found = await db.owaspEntry.findFirst({ where: { list: o.list, rank: o.rank } });
    if (!found) {
      await db.owaspEntry.create({
        data: {
          list: o.list, rank: o.rank, name: o.name, summary: o.summary,
          mitigations: JSON.stringify(o.mitigations), officialUrl: o.officialUrl,
          verificationStatus: 'VERIFIED', lastVerifiedAt: new Date(),
        },
      });
    }
  }
  console.log(`  OWASP entries: ${owasp.length} ensured`);

  // ── AI Security entries ───────────────────────────────────────────────────
  const ai = [
    { category: 'prompt-injection', name: 'Direct Prompt Injection', summary: 'Adversarial user input manipulates the model.', mitigations: ['Input validation', 'Privilege separation', 'Output filtering'], officialUrl: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/' },
    { category: 'prompt-injection', name: 'Indirect Prompt Injection', summary: 'Malicious content in untrusted data sources (web pages, documents) is consumed by the LLM and acts as instructions.', mitigations: ['Treat retrieved content as untrusted', 'Mark retrieved content with delimiters', 'Limit tool scope'], officialUrl: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/' },
    { category: 'jailbreak', name: 'Jailbreaking', summary: 'Bypasses safety filters via role-play, encoding, or adversarial prompts.', mitigations: ['Use established safety classifiers', 'Filter prompts and completions', 'Constrain model behaviour'], officialUrl: 'https://genai.owasp.org/llmrisk/' },
    { category: 'data-leakage', name: 'Sensitive Information Disclosure', summary: 'LLM returns data it should not.', mitigations: ['Output filtering', 'DLP', 'Avoid training on sensitive data'], officialUrl: 'https://genai.owasp.org/llmrisk/llm02-sensitive-information-disclosure/' },
    { category: 'output-handling', name: 'Insecure Output Handling', summary: 'LLM output is rendered or executed without validation.', mitigations: ['Treat as untrusted input', 'Encode on render', 'Type-safe parsing'], officialUrl: 'https://genai.owasp.org/llmrisk/llm05-improper-output-handling/' },
    { category: 'tool-use', name: 'Insecure Tool Use', summary: 'LLM tools accept dangerous arguments or operate without authorisation.', mitigations: ['Argument validation', 'Tool allow-list', 'Confirmation tokens for state changes'], officialUrl: 'https://genai.owasp.org/llmrisk/llm06-excessive-agency/' },
    { category: 'agents', name: 'Excessive Agency', summary: 'AI agents perform state-changing actions beyond their intended authority.', mitigations: ['Per-action authorisation', 'Human-in-the-loop for sensitive actions', 'Sandbox tool execution'], officialUrl: 'https://genai.owasp.org/llmrisk/llm06-excessive-agency/' },
    { category: 'rag', name: 'RAG Security', summary: 'RAG pipelines are vulnerable to data poisoning, leakage, and retrieval poisoning.', mitigations: ['Access controls on the vector store', 'Sanitise retrieved content', 'Source attribution'], officialUrl: 'https://genai.owasp.org/llmrisk/llm08-vector-and-embedding-weaknesses/' },
    { category: 'supply-chain', name: 'Model Supply Chain', summary: 'Vulnerable or malicious models, datasets, or libraries compromise the LLM system.', mitigations: ['Model SBOM', 'Vendor verification', 'Signed models'], officialUrl: 'https://genai.owasp.org/llmrisk/llm03-supply-chain-vulnerabilities/' },
    { category: 'data-poisoning', name: 'Data Poisoning', summary: 'Adversarial training or fine-tuning data alters model behaviour.', mitigations: ['Provenance tracking', 'Statistical anomaly detection', 'Periodic re-evaluation'], officialUrl: 'https://genai.owasp.org/llmrisk/llm04-data-and-model-poisoning/' },
    { category: 'model-theft', name: 'Model Theft', summary: 'Model weights or proprietary prompts are extracted.', mitigations: ['Output rate limiting', 'Watermarking', 'Strict access controls'], officialUrl: 'https://genai.owasp.org/llmrisk/' },
    { category: 'adversarial-inputs', name: 'Adversarial Inputs', summary: 'Perturbed inputs crafted to cause misclassification.', mitigations: ['Adversarial training', 'Input preprocessing', 'Confidence thresholds'], officialUrl: 'https://genai.owasp.org/llmrisk/' },
    { category: 'dos', name: 'AI Denial of Service', summary: 'Adversaries trigger expensive model calls or context overflow.', mitigations: ['Rate limits', 'Token caps', 'Request size limits'], officialUrl: 'https://genai.owasp.org/llmrisk/llm10-unbounded-consumption/' },
    { category: 'identity', name: 'Identity and Authorization for Agents', summary: 'AI agents must authenticate and be authorised like any other principal.', mitigations: ['Agent identity (e.g. tokens, mTLS)', 'Per-action authorisation', 'Auditable agent identity'], officialUrl: 'https://genai.owasp.org/llmrisk/' },
    { category: 'oversight', name: 'Human Oversight', summary: 'High-risk AI decisions need human review and override.', mitigations: ['Human-in-the-loop', 'Audit trail', 'Reversibility'], officialUrl: 'https://artificialintelligenceact.eu/' },
  ];
  for (const a of ai) {
    const found = await db.aiSecurityEntry.findFirst({ where: { category: a.category, name: a.name } });
    if (!found) {
      await db.aiSecurityEntry.create({
        data: {
          category: a.category, name: a.name, summary: a.summary,
          mitigations: JSON.stringify(a.mitigations), officialUrl: a.officialUrl,
          verificationStatus: 'VERIFIED', lastVerifiedAt: new Date(),
        },
      });
    }
  }
  console.log(`  AI Security entries: ${ai.length} ensured`);

  // ── Compliance frameworks + controls ──────────────────────────────────────
  const frameworks = [
    { code: 'GDPR', name: 'General Data Protection Regulation', kind: 'regulation', officialUrl: 'https://gdpr.eu/',
      controls: [
        { code: 'GDPR-5', title: 'Principles relating to processing of personal data', description: 'Lawfulness, fairness, transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity, accountability.' },
        { code: 'GDPR-6', title: 'Lawfulness of processing', description: 'Identify a lawful basis (consent, contract, legal obligation, vital interest, public task, legitimate interest).' },
        { code: 'GDPR-7', title: 'Consent', description: 'Freely given, specific, informed, unambiguous.' },
        { code: 'GDPR-13', title: 'Information to be provided', description: 'Inform data subjects of processing activities.' },
        { code: 'GDPR-25', title: 'Data protection by design and by default', description: 'Build privacy into the design of systems and defaults.' },
        { code: 'GDPR-30', title: 'Records of processing activities', description: 'Maintain RoPA for the organisation.' },
        { code: 'GDPR-32', title: 'Security of processing', description: 'Implement appropriate technical and organisational measures (pseudonymisation, encryption, resilience, regular testing).' },
        { code: 'GDPR-33', title: 'Notification of a personal data breach', description: 'Notify the supervisory authority within 72 hours.' },
        { code: 'GDPR-35', title: 'Data protection impact assessment', description: 'Conduct a DPIA for high-risk processing.' },
        { code: 'GDPR-44', title: 'Transfers to third countries', description: 'Safeguards for international data transfers.' },
      ]
    },
    { code: 'NIS2', name: 'Network and Information Security Directive 2', kind: 'directive', officialUrl: 'https://digital-strategy.ec.europa.eu/en/policies/nis2-directive',
      controls: [
        { code: 'NIS2-21-1', title: 'Risk-management measures', description: 'Entities shall take appropriate and proportionate technical, operational, and organisational measures to manage risks.' },
        { code: 'NIS2-21-2', title: 'Reporting obligations', description: 'Incident reporting with early-warning (24h), notification (72h), and final-report timelines.' },
        { code: 'NIS2-21-3', title: 'Supervision and enforcement', description: 'Competent authorities supervise and enforce via sanctions.' },
        { code: 'NIS2-23', title: 'Incident handling', description: 'Define and document incident-handling procedures.' },
        { code: 'NIS2-28', title: 'Coordinated security risk assessments', description: 'Coordinated risk assessments for critical ICT supply chains.' },
      ]
    },
    { code: 'CRA', name: 'Cyber Resilience Act', kind: 'regulation', officialUrl: 'https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act',
      controls: [
        { code: 'CRA-13', title: 'Cybersecurity requirements for products with digital elements', description: 'Products must be designed, developed, and produced to ensure an appropriate level of cybersecurity.' },
        { code: 'CRA-14', title: 'Vulnerability and incident reporting', description: 'Manufacturers must report actively exploited vulnerabilities and incidents.' },
        { code: 'CRA-20', title: 'Free and open-source software exceptions', description: 'FOSS developed outside a commercial context is excluded from most obligations.' },
        { code: 'CRA-Annex-I', title: 'Security requirements (Annex I)', description: 'Security-by-default, no known exploitable vulnerabilities, default secure configuration.' },
      ]
    },
    { code: 'DORA', name: 'Digital Operational Resilience Act', kind: 'regulation', officialUrl: 'https://digital-finance-2025.europa.eu/',
      controls: [
        { code: 'DORA-5', title: 'ICT risk management', description: 'Financial entities shall identify, classify, and document ICT-related risks.' },
        { code: 'DORA-6', title: 'ICT-related incident reporting', description: 'Report major ICT-related incidents with classification and timelines.' },
        { code: 'DORA-7', title: 'Digital operational resilience testing', description: 'Establish a testing programme, including TLPT for systemically important entities.' },
        { code: 'DORA-8', title: 'Information sharing arrangements', description: 'Voluntary information sharing on cyber threats and vulnerabilities.' },
        { code: 'DORA-9', title: 'Third-party risk management', description: 'Manage ICT third-party risk; maintain a register of information.' },
      ]
    },
    { code: 'EU-AI-ACT', name: 'EU AI Act', kind: 'regulation', officialUrl: 'https://artificialintelligenceact.eu/',
      controls: [
        { code: 'AI-6', title: 'Classification of AI systems', description: 'Prohibited / high-risk / limited / minimal risk classification.' },
        { code: 'AI-9', title: 'High-risk AI systems list', description: 'Annex III high-risk use cases (e.g. biometrics, critical infrastructure, education, employment, essential services, law enforcement).' },
        { code: 'AI-10', title: 'Transparency obligations', description: 'Inform users they are interacting with an AI system; mark AI-generated content.' },
        { code: 'AI-13', title: 'Fundamental rights impact assessment', description: 'For certain high-risk deployments, conduct an FRIA.' },
        { code: 'AI-14', title: 'Logging requirements', description: 'High-risk AI systems must keep automatic logs.' },
        { code: 'AI-15', title: 'Quality management system', description: 'Establish and document a QMS throughout the lifecycle.' },
        { code: 'AI-27', title: 'GPAI model obligations', description: 'General-purpose AI model providers must provide technical documentation and respect copyright.' },
      ]
    },
  ];
  for (const fw of frameworks) {
    const foundFw = await db.complianceFramework.findUnique({ where: { code: fw.code } });
    const frameworkId = foundFw?.id ?? (await db.complianceFramework.create({
      data: { code: fw.code, name: fw.name, kind: fw.kind, officialUrl: fw.officialUrl, verificationStatus: 'VERIFIED', lastVerifiedAt: new Date() },
    })).id;
    for (const c of fw.controls) {
      const foundCtrl = await db.complianceControl.findFirst({ where: { frameworkId, code: c.code } });
      if (!foundCtrl) {
        await db.complianceControl.create({
          data: {
            frameworkId, code: c.code, title: c.title, description: c.description,
            applicability: 'POSSIBLY_APPLICABLE', status: 'unknown',
          },
        });
      }
    }
  }
  console.log(`  Compliance frameworks: ${frameworks.length} ensured`);

  console.log('Seed completed.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
