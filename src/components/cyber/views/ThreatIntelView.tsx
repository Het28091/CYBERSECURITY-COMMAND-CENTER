// Threat Intel — placeholder view that explains what threat intelligence is
// and links to authoritative sources. Honest: NOT_YET_CONFIGURED until a
// real threat-intel source is integrated.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Radar, ExternalLink } from 'lucide-react';

const SOURCES = [
  { name: 'MITRE ATT&CK', url: 'https://attack.mitre.org/', desc: 'Tactics, techniques, and procedures.' },
  { name: 'CISA Known Exploited Vulnerabilities', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', desc: 'US CISA KEV catalogue.' },
  { name: 'NIST NVD', url: 'https://nvd.nist.gov/', desc: 'National Vulnerability Database.' },
  { name: 'OSV.dev', url: 'https://osv.dev/', desc: 'Open source vulnerability database (used by this app).' },
  { name: 'EUROPOL IOCTA', url: 'https://www.europol.europa.eu/operations-services-and-innovation/publications/internet-organised-crime-threat-assessment-iocta', desc: 'Internet Organised Crime Threat Assessment.' },
];

export function ThreatIntelView() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Threat Intelligence</h1>
        <p className="text-xs text-muted-foreground">Authoritative external threat-intelligence sources. (Direct integration with a feed requires a configured API key — not done in this session.)</p>
      </div>
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="py-3 text-xs flex items-center gap-2"><Radar className="h-4 w-4 text-amber-400 shrink-0" /><span className="text-amber-200">Status: NOT_YET_CONFIGURED — direct threat-intel feeds require authenticated endpoints. Use the CVEs view for OSV.dev/NVD queries until a feed is configured in Settings.</span></CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SOURCES.map((s) => (
          <Card key={s.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><a href={s.url} target="_blank" rel="noreferrer" className="hover:text-primary flex items-center gap-1.5">{s.name}<ExternalLink className="h-3 w-3 inline" /></a></CardTitle>
              <CardDescription className="text-[11px]">{s.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
