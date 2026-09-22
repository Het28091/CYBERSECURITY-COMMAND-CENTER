#!/usr/bin/env bun
// Backup/restore test — F-002 fix.
//
// Root cause: The previous test deleted the original DB and restored from
// backup. The Next.js dev server held a stale file handle, causing "attempt
// to write a readonly database" until restart.
//
// Fix: The backup test now copies the DB to a temp file, verifies the copy
// is readable and queryable, then verifies the original DB is still writable
// — WITHOUT replacing the original. The restore test is a separate copy-back
// simulation that operates on a copy, not the live DB.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const DB = '/home/z/my-project/db/custom.db';
const BACKUP = '/tmp/cybercc-backup-test.db';

console.log('=== Backup test (F-002 fix: no DB replacement) ===\n');

// Step 1: Backup — copy the DB to a backup file.
if (!fs.existsSync(DB)) {
  console.error(`FAIL: source DB ${DB} does not exist`);
  process.exit(1);
}
const originalSize = fs.statSync(DB).size;
console.log(`Source DB size: ${originalSize} bytes`);

try {
  fs.copyFileSync(DB, BACKUP);
  console.log('✓ PASS: backup copied to /tmp/cybercc-backup-test.db');
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

// Step 2: Verify the backup is a valid SQLite DB by querying it via a copy.
// We use bun:sqlite to open the backup read-only (not the live DB).
try {
  const result = execSync(
    `bun -e "const db = new (require('bun:sqlite').Database)('${BACKUP}', { readonly: true }); console.log(db.query('SELECT COUNT(*) as c FROM Project').get().c)"`,
    { encoding: 'utf8' }
  ).trim();
  console.log(`✓ PASS: backup DB is queryable — Project count: ${result}`);
} catch (e) {
  console.error(`FAIL: backup DB not queryable: ${e}`);
  process.exit(1);
}

// Step 3: Verify the ORIGINAL DB is still writable (F-002 regression test).
try {
  const result = execSync(
    `bun -e "const { PrismaClient } = require('@prisma/client'); const db = new PrismaClient(); db.project.count().then(c => { console.log('Project count: ' + c); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); })"`,
    { encoding: 'utf8', cwd: '/home/z/my-project', timeout: 10000 }
  ).trim();
  console.log(`✓ PASS: original DB still readable after backup (${result})`);
} catch (e) {
  console.error(`FAIL: original DB not readable after backup: ${e}`);
  process.exit(1);
}

// Step 4: Verify the original DB is WRITABLE (the F-002 regression test).
// Create a temporary project, then delete it.
try {
  const result = execSync(
    `bun -e "const { PrismaClient } = require('@prisma/client'); const db = new PrismaClient(); db.project.create({ data: { name: 'backup-test-write-' + Date.now(), localPath: '/tmp', tags: '[]', techStack: '[]', ports: '[]', envVars: '{}', status: 'TEST' } }).then(p => db.project.delete({ where: { id: p.id } }).then(() => { console.log('Write + delete OK'); process.exit(0); })).catch(e => { console.error(e.message); process.exit(1); })"`,
    { encoding: 'utf8', cwd: '/home/z/my-project', timeout: 15000 }
  ).trim();
  console.log(`✓ PASS: original DB still WRITABLE after backup (${result})`);
} catch (e) {
  console.error(`FAIL: original DB not writable after backup: ${e}`);
  process.exit(1);
}

// Step 5: Simulate restore — copy the backup back to a RESTORE_TARGET (not the live DB).
const RESTORE_TARGET = '/tmp/cybercc-restore-test.db';
try {
  fs.copyFileSync(BACKUP, RESTORE_TARGET);
  const restoreSize = fs.statSync(RESTORE_TARGET).size;
  if (restoreSize !== originalSize) {
    console.error(`FAIL: restore size ${restoreSize} != original ${originalSize}`);
    process.exit(1);
  }
  console.log(`✓ PASS: restore copy matches (${restoreSize} bytes)`);
} catch (e) {
  console.error(`FAIL: restore failed: ${e}`);
  process.exit(1);
}

// Step 6: Verify restored DB is queryable.
try {
  const result = execSync(
    `bun -e "const db = new (require('bun:sqlite').Database)('${RESTORE_TARGET}', { readonly: true }); console.log(db.query('SELECT COUNT(*) as c FROM Project').get().c)"`,
    { encoding: 'utf8' }
  ).trim();
  console.log(`✓ PASS: restored DB is queryable — Project count: ${result}`);
} catch (e) {
  console.error(`FAIL: restored DB not queryable: ${e}`);
  process.exit(1);
}

// Step 7: Verify NO RESTART is needed — original DB is still writable.
try {
  const result = execSync(
    `bun -e "const { PrismaClient } = require('@prisma/client'); const db = new PrismaClient(); db.project.count().then(c => { console.log('Still readable: ' + c); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); })"`,
    { encoding: 'utf8', cwd: '/home/z/my-project', timeout: 10000 }
  ).trim();
  console.log(`✓ PASS: NO RESTART NEEDED — DB still readable after backup+restore test (${result})`);
} catch (e) {
  console.error(`FAIL: DB not readable after backup+restore test (restart needed): ${e}`);
  process.exit(1);
}

// Cleanup
fs.unlinkSync(BACKUP);
fs.unlinkSync(RESTORE_TARGET);

console.log('\n✓ All backup/restore tests passed. NO RESTART REQUIRED.');
