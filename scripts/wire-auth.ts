#!/usr/bin/env bun
// Wire auth into all sensitive API routes.
// This is a one-shot script that updates route files in place.

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROUTES_DIR = '/home/z/my-project/src/app/api';

// Map of routes → required action
const ROUTE_ACTIONS: { route: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; action: string }[] = [
  // projects — registry CRUD
  { route: 'projects', method: 'GET', action: 'read' },
  { route: 'projects', method: 'POST', action: 'create' },
  { route: 'projects/[id]', method: 'GET', action: 'read' },
  { route: 'projects/[id]', method: 'PATCH', action: 'update' },
  { route: 'projects/[id]', method: 'DELETE', action: 'delete' },
  // projects — actions
  { route: 'projects/[id]/discover', method: 'POST', action: 'run' },
  { route: 'projects/[id]/readme', method: 'POST', action: 'run' },
  { route: 'projects/[id]/verify', method: 'POST', action: 'run' },
  { route: 'projects/[id]/run', method: 'POST', action: 'run' },
  { route: 'projects/[id]/stop', method: 'POST', action: 'stop' },
  { route: 'projects/[id]/restart', method: 'POST', action: 'run' },
  { route: 'projects/[id]/scan', method: 'POST', action: 'scan' },
  { route: 'projects/[id]/scans', method: 'GET', action: 'read' },
  { route: 'projects/[id]/findings', method: 'GET', action: 'read' },
  { route: 'projects/[id]/logs', method: 'GET', action: 'read' },
  { route: 'projects/[id]/health', method: 'GET', action: 'read' },
  // knowledge — read access
  { route: 'tools', method: 'GET', action: 'read' },
  { route: 'owasp', method: 'GET', action: 'read' },
  { route: 'ai-security', method: 'GET', action: 'read' },
  { route: 'compliance', method: 'GET', action: 'read' },
  { route: 'cves', method: 'GET', action: 'read' },
  { route: 'scanners', method: 'GET', action: 'read' },
  { route: 'audit', method: 'GET', action: 'read' },
  { route: 'search', method: 'GET', action: 'read' },
  { route: 'system/health', method: 'GET', action: 'read' },
  { route: 'system/datasources', method: 'GET', action: 'read' },
  { route: 'system/datasources/[code]/refresh', method: 'POST', action: 'admin' },
  // governance — admin only
  { route: 'settings', method: 'GET', action: 'admin' },
  { route: 'settings', method: 'PATCH', action: 'admin' },
  { route: 'compliance/[frameworkId]/controls/[controlId]', method: 'PATCH', action: 'admin' },
  // verify — read access (it's a query, not a mutation)
  { route: 'verify', method: 'POST', action: 'run' },
  { route: 'verify/list', method: 'GET', action: 'read' },
  { route: 'verify/entry/[kind]/[id]', method: 'POST', action: 'run' },
  // threat-intel — admin (it's an external fetch action)
  { route: 'threat-intel/feeds', method: 'GET', action: 'read' },
  { route: 'threat-intel/feeds', method: 'POST', action: 'admin' },
  { route: 'threat-intel/feeds/[id]/refresh', method: 'POST', action: 'admin' },
  { route: 'threat-intel/indicators', method: 'GET', action: 'read' },
  // export — read
  { route: 'export/[kind]', method: 'GET', action: 'read' },
];

function patchFile(filePath: string, method: string, action: string): { changed: boolean; reason: string } {
  if (!fs.existsSync(filePath)) return { changed: false, reason: 'file not found' };
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('requireAuth')) return { changed: false, reason: 'already has auth' };

  // Find the export function for the given method.
  // It's either `export async function GET(req: NextRequest,` or
  // `export async function GET(req: NextRequest)` or `export async function GET()`
  const methodRegex = new RegExp(`export async function ${method}\\s*\\(\\s*([^)]*)\\)\\s*{`, '');
  const match = content.match(methodRegex);
  if (!match) return { changed: false, reason: `method ${method} not found` };

  const fullSig = match[0];
  const params = match[1];
  // Detect the request variable name. Usually `req` or `_req`.
  const reqVarMatch = params.match(/(\w+)\s*:\s*NextRequest/);
  const reqVar = reqVarMatch ? reqVarMatch[1] : 'req';

  // Insert the auth gate after the function opening brace.
  // We need to find the opening brace and insert immediately after.
  const insertAfter = fullSig + '\n';
  const authGate = `  const __auth = await requireAuth(${reqVar}, '${action}');\n  if (!__auth.ok) return __auth.response!;\n`;

  // Replace the first occurrence of the function signature + opening brace
  // with the signature + opening brace + auth gate.
  const newContent = content.replace(methodRegex, (full) => full + '\n' + authGate);

  // Add the import line at the top after the last existing import line
  const importLine = "import { requireAuth } from '@/lib/cyber/auth';\n";
  // Find the last `import ... from '...';\n` line
  const importMatches = content.match(/^import [^;]+;\s*$/gm);
  if (importMatches && importMatches.length > 0) {
    const lastImport = importMatches[importMatches.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    const insertPos = lastImportIndex + lastImport.length;
    const withImport = content.slice(0, insertPos) + importLine + content.slice(insertPos);
    // Now apply the auth gate insertion to this updated content
    const finalContent = withImport.replace(methodRegex, (full) => full + '\n' + authGate);
    fs.writeFileSync(filePath, finalContent);
    return { changed: true, reason: 'patched' };
  }
  return { changed: false, reason: 'no import line found' };
}

let patchedCount = 0;
let skippedCount = 0;
let failedCount = 0;

for (const { route, method, action } of ROUTE_ACTIONS) {
  const filePath = path.join(ROUTES_DIR, route, 'route.ts');
  const result = patchFile(filePath, method, action);
  if (result.changed) {
    console.log(`✓ PATCHED: ${method} ${route} → action=${action}`);
    patchedCount++;
  } else {
    console.log(`○ SKIPPED: ${method} ${route} → ${result.reason}`);
    skippedCount++;
  }
}

console.log(`\nDone. Patched: ${patchedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
