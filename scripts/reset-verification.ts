#!/usr/bin/env bun
// Reset all previously-stamped "VERIFIED" seed entries to UNVERIFIED.
// This is the audit fix for GAP-003.

import { db } from '../src/lib/db';

async function main() {
  console.log('Resetting previously-stamped VERIFIED entries to UNVERIFIED...');

  const [t, o, a, f] = await Promise.all([
    db.securityTool.updateMany({ where: { verificationStatus: 'VERIFIED', lastVerifiedAt: { not: null } }, data: { verificationStatus: 'UNVERIFIED', lastVerifiedAt: null } }),
    db.owaspEntry.updateMany({ where: { verificationStatus: 'VERIFIED', lastVerifiedAt: { not: null } }, data: { verificationStatus: 'UNVERIFIED', lastVerifiedAt: null } }),
    db.aiSecurityEntry.updateMany({ where: { verificationStatus: 'VERIFIED', lastVerifiedAt: { not: null } }, data: { verificationStatus: 'UNVERIFIED', lastVerifiedAt: null } }),
    db.complianceFramework.updateMany({ where: { verificationStatus: 'VERIFIED', lastVerifiedAt: { not: null } }, data: { verificationStatus: 'UNVERIFIED', lastVerifiedAt: null } }),
  ]);

  console.log(`  SecurityTools: ${t.count} updated`);
  console.log(`  OwaspEntries:  ${o.count} updated`);
  console.log(`  AiSecurity:    ${a.count} updated`);
  console.log(`  Frameworks:    ${f.count} updated`);
  console.log('\nAll seeded entries now correctly labeled UNVERIFIED.');
  console.log('The UI will no longer display misleading VERIFIED pills for static seed data.');
}
main().catch(console.error).finally(() => process.exit(0));
