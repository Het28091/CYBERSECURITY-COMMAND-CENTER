import { db } from '../src/lib/db';
async function main() {
  console.log('tools:', await db.securityTool.count());
  console.log('owasp:', await db.owaspEntry.count());
  console.log('ai:', await db.aiSecurityEntry.count());
  console.log('frameworks:', await db.complianceFramework.count());
  console.log('controls:', await db.complianceControl.count());
  console.log('sources:', await db.dataSource.count());
}
main().catch(console.error).finally(() => process.exit(0));
