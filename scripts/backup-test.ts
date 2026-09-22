#!/usr/bin/env bun
// Backup/restore test — F-002 fix.
// Uses Prisma directly (no subprocess spawning) for CI portability.

import * as fs from 'node:fs';
import { db } from '../src/lib/db';

const DB = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('file:', '') : process.cwd() + '/db/custom.db';
const BACKUP = '/tmp/cybercc-backup-test.db';
const RESTORE_TARGET = '/tmp/cybercc-restore-test.db';

console.log('=== Backup test (F-002 fix: no DB replacement) ===\n');

// Step 1: Backup
if (!fs.existsSync(DB)) {
  console.error(`FAIL: source DB ${DB} does not exist`);
  process.exit(1);
}
const originalSize = fs.statSync(DB).size;
console.log(`Source DB size: ${originalSize} bytes`);

try {
  fs.copyFileSync(DB, BACKUP);
  console.log('✓ PASS: backup copied');
} catch (e) {
  console.error(`FAIL: backup copy failed: ${e}`);
  process.exit(1);
}

const backupSize = fs.statSync(BACKUP).size;
if (backupSize !== originalSize) {
  console.error(`FAIL: backup size ${backupSize} != original ${originalSize}`);
  process.exit(1);
}
console.log(`✓ PASS: backup size matches (${backupSize} bytes)`);

// Step 2: Verify backup is queryable (read-only, separate connection)
try {
  const { PrismaClient } = await import('@prisma/client');
  const backupDb = new PrismaClient({ datasources: { db: { url: `file:${BACKUP}` } } });
  const count = await backupDb.project.count();
  console.log(`✓ PASS: backup DB queryable — Project count: ${count}`);
  await backupDb.$disconnect();
} catch (e) {
  console.error(`FAIL: backup not queryable: ${e}`);
  process.exit(1);
}

// Step 3: Verify original DB is still readable (via the app's Prisma client)
try {
  const count = await db.project.count();
  console.log(`✓ PASS: original DB still readable (${count} projects)`);
} catch (e) {
  console.error(`FAIL: original DB not readable: ${e}`);
  process.exit(1);
}

// Step 4: Verify original DB is WRITABLE (F-002 regression test)
try {
  const p = await db.project.create({
    data: {
      name: 'backup-test-write-' + Date.now(),
      localPath: '/tmp',
      tags: '[]', techStack: '[]', ports: '[]', envVars: '{}',
      status: 'TEST',
    },
  });
  await db.project.delete({ where: { id: p.id } });
  console.log('✓ PASS: original DB still WRITABLE after backup');
} catch (e) {
  console.error(`FAIL: original DB not writable: ${e}`);
  process.exit(1);
}

// Step 5: Restore simulation (copy to separate target, not the live DB)
try {
  fs.copyFileSync(BACKUP, RESTORE_TARGET);
  const restoreSize = fs.statSync(RESTORE_TARGET).size;
  if (restoreSize !== originalSize) {
    console.error(`FAIL: restore size mismatch`);
    process.exit(1);
  }
  console.log(`✓ PASS: restore copy matches (${restoreSize} bytes)`);
} catch (e) {
  console.error(`FAIL: restore failed: ${e}`);
  process.exit(1);
}

// Step 6: Verify restored DB is queryable
try {
  const { PrismaClient } = await import('@prisma/client');
  const restoreDb = new PrismaClient({ datasources: { db: { url: `file:${RESTORE_TARGET}` } } });
  const count = await restoreDb.project.count();
  console.log(`✓ PASS: restored DB queryable — Project count: ${count}`);
  await restoreDb.$disconnect();
} catch (e) {
  console.error(`FAIL: restored DB not queryable: ${e}`);
  process.exit(1);
}

// Step 7: NO RESTART NEEDED — original DB still works
try {
  const count = await db.project.count();
  console.log(`✓ PASS: NO RESTART NEEDED — DB still readable (${count} projects)`);
} catch (e) {
  console.error(`FAIL: DB not readable after test: ${e}`);
  process.exit(1);
}

// Cleanup
fs.unlinkSync(BACKUP);
fs.unlinkSync(RESTORE_TARGET);

console.log('\n✓ All backup/restore tests passed. NO RESTART REQUIRED.');
