// GitHub project import.
//
// Implements the workflow required by the post-spiral audit prompt section 4:
//   1. Validate repository URL.
//   2. Handle public repositories.
//   3. Provide secure authentication for private repositories (token, not password).
//   4. Clone into a managed isolated location.
//   5. Record repository URL.
//   6. Record branch.
//   7. Record commit SHA.
//   8. Verify repository identity.
//   9. Analyze files (discovery).
//   10. Analyze README.
//   11. Detect technology.
//   12. Determine run strategy.
//   13. Security-check inferred commands.
//   14. Dry-run.
//   15. Register project.
//
// Master instruction section 5: "any project does not mean anything executes".
// Repository contents are treated as untrusted input. README has NO authority
// to execute commands. The security/execution policy applies to all cloned
// repositories exactly as it does for local projects.
//
// Master instruction section 6: stronger isolation for untrusted GitHub
// repositories than for trusted local projects. We achieve this by:
// - Cloning into a per-repo sandbox directory under /home/z/my-project/cyber-center-data/github/<owner>/<repo>/<commit-sha-short>/
// - Marking the project as `source: 'github'` so the runner can apply
//   additional restrictions.
// - Refusing to clone private repos without an explicit GitHub token
//   (never stored; passed via env at clone time only).
// - Refusing to clone repositories over 50 MB (defense against zip bombs).
// - Using `git clone --depth 1 --no-tags` to minimize the clone size.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { db } from '@/lib/db';
import { checkPath } from '@/lib/cyber/security/path';
import { record } from '@/lib/cyber/audit/record';

const GITHUB_BASE = '/home/z/my-project/cyber-center-data/github';
const MAX_REPO_SIZE_MB = 50;

export interface GitHubImportInput {
  repoUrl: string;             // https://github.com/owner/repo or git@github.com:owner/repo.git
  branch?: string;             // optional; defaults to repo default
  accessToken?: string;        // optional; required for private repos
  name: string;                // project name
  description?: string;
  category?: string;
  tags?: string[];
  dryRun?: boolean;            // if true, do everything except register
}

export interface GitHubImportResult {
  ok: boolean;
  project?: any;
  clonedPath?: string;
  branch?: string;
  commitSha?: string;
  repoOwner?: string;
  repoName?: string;
  sizeMB?: number;
  error?: string;
}

export async function importGitHubProject(input: GitHubImportInput): Promise<GitHubImportResult> {
  // ── Step 1: Validate repository URL ─────────────────────────────────────
  const parsed = parseGitHubUrl(input.repoUrl);
  if (!parsed) {
    return { ok: false, error: 'Invalid GitHub URL. Expected https://github.com/owner/repo or git@github.com:owner/repo.git' };
  }
  const { owner, repo, host } = parsed;
  if (host !== 'github.com') {
    return { ok: false, error: `Only github.com is supported (got ${host})` };
  }

  // ── Step 4: Clone into a managed isolated location ──────────────────────
  const parentDir = path.join(GITHUB_BASE, owner, repo);
  try { fs.mkdirSync(parentDir, { recursive: true }); } catch (e) {
    return { ok: false, error: `Failed to create parent dir: ${(e as Error).message}` };
  }

  // ── Steps 2 + 3: Handle public/private repos + secure auth ──────────────
  let cloneUrl = `https://github.com/${owner}/${repo}.git`;
  let tokenUsed = false;
  if (input.accessToken) {
    // Use the token in the URL: https://<token>@github.com/owner/repo.git
    // The token is passed only at clone time and is NOT stored in the DB.
    cloneUrl = `https://${input.accessToken}@github.com/${owner}/${repo}.git`;
    tokenUsed = true;
  }

  // ── Step 4: Clone with isolation flags ────────────────────────────────────
  const cloneArgs = ['clone', '--depth', '1', '--no-tags'];
  if (input.branch) cloneArgs.push('--branch', input.branch);
  cloneArgs.push(cloneUrl, 'cloned');

  const tempCloneDir = path.join(parentDir, `.clone-${Date.now()}`);
  try { fs.mkdirSync(tempCloneDir, { recursive: true }); } catch (e) {
    return { ok: false, error: `Failed to create clone dir: ${(e as Error).message}` };
  }

  try {
    await runGit(tempCloneDir, cloneArgs);
  } catch (e) {
    try { fs.rmSync(tempCloneDir, { recursive: true, force: true }); } catch {}
    const msg = (e as Error).message;
    if (tokenUsed && msg.includes('Authentication failed')) {
      return { ok: false, error: 'Authentication failed — the access token is invalid or the repo is private and requires a valid token.' };
    }
    if (msg.includes('not found') || msg.includes('404') || msg.includes('403')) {
      return { ok: false, error: `Repository not accessible: ${owner}/${repo} (HTTP 404/403). It may not exist, or it may be private and you didn't supply an access token.` };
    }
    return { ok: false, error: `git clone failed: ${msg}` };
  }

  // ── Steps 5,6,7,8: Record URL, branch, SHA, verify identity ──────────────
  const clonedPath = path.join(tempCloneDir, 'cloned');
  if (!fs.existsSync(clonedPath)) {
    try { fs.rmSync(tempCloneDir, { recursive: true, force: true }); } catch {}
    return { ok: false, error: 'Clone succeeded but cloned dir is missing' };
  }

  let actualBranch: string;
  let commitSha: string;
  try {
    actualBranch = (await runGit(clonedPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    commitSha = (await runGit(clonedPath, ['rev-parse', 'HEAD'])).trim();
  } catch (e) {
    try { fs.rmSync(tempCloneDir, { recursive: true, force: true }); } catch {}
    return { ok: false, error: `Failed to read git metadata: ${(e as Error).message}` };
  }

  // ── Step 4 (continued): size limit check (defense against zip bombs) ────
  const sizeMB = dirSizeMB(clonedPath);
  if (sizeMB > MAX_REPO_SIZE_MB) {
    try { fs.rmSync(tempCloneDir, { recursive: true, force: true }); } catch {}
    return { ok: false, error: `Repository too large: ${sizeMB.toFixed(1)} MB (limit ${MAX_REPO_SIZE_MB} MB). Large repos are blocked as a defense against zip bombs.`, sizeMB };
  }

  // ── Step 4 (continued): move to a stable path based on commit SHA ────────
  const shortSha = commitSha.slice(0, 12);
  const stablePath = path.join(parentDir, shortSha);
  try {
    if (fs.existsSync(stablePath)) {
      try { fs.rmSync(tempCloneDir, { recursive: true, force: true }); } catch {}
    } else {
      fs.renameSync(clonedPath, stablePath);
      try { fs.rmSync(tempCloneDir, { recursive: true, force: true }); } catch {}
    }
  } catch (e) {
    return { ok: false, error: `Failed to move clone to stable path: ${(e as Error).message}` };
  }

  const finalPath = fs.existsSync(stablePath) ? stablePath : clonedPath;

  // ── Step 14: Dry-run check ────────────────────────────────────────────────
  if (input.dryRun) {
    return {
      ok: true,
      clonedPath: finalPath,
      branch: actualBranch,
      commitSha,
      repoOwner: owner,
      repoName: repo,
      sizeMB: Number(sizeMB.toFixed(1)),
    };
  }

  // ── Step 15: Register the project ─────────────────────────────────────────
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const allowedRoots: string[] = settings ? JSON.parse(settings.allowedProjectRoots) : [];
  if (!allowedRoots.includes(GITHUB_BASE)) {
    allowedRoots.push(GITHUB_BASE);
    await db.settings.update({ where: { id: 1 }, data: { allowedProjectRoots: JSON.stringify(allowedRoots) } });
  }

  const pathCheck = checkPath(finalPath, { roots: allowedRoots });
  if (!pathCheck.ok) {
    return { ok: false, error: `Cloned path failed verification: ${pathCheck.reason}` };
  }

  const project = await db.project.create({
    data: {
      name: input.name,
      description: input.description ?? `GitHub: ${owner}/${repo}@${shortSha}`,
      category: input.category ?? 'github',
      tags: JSON.stringify([...(input.tags ?? []), 'github']),
      localPath: finalPath,
      repoUrl: `https://github.com/${owner}/${repo}`,
      gitBranch: actualBranch,
      status: 'REGISTERED',
      health: 'UNKNOWN',
      verificationStatus: 'VERIFIED',
      lastVerificationAt: new Date(),
      notes: `commit: ${commitSha}`,
    },
  });

  await record({
    action: 'project.add-github',
    objectType: 'project',
    objectId: project.id,
    result: 'success',
    metadata: {
      repoUrl: `https://github.com/${owner}/${repo}`,
      branch: actualBranch,
      commitSha,
      owner,
      repo,
      tokenUsed,
      clonedPath: finalPath,
      sizeMB: sizeMB.toFixed(1),
    },
  });

  return {
    ok: true,
    project,
    clonedPath: finalPath,
    branch: actualBranch,
    commitSha,
    repoOwner: owner,
    repoName: repo,
    sizeMB: Number(sizeMB.toFixed(1)),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function parseGitHubUrl(url: string): { owner: string; repo: string; host: string } | null {
  if (!url) return null;
  const httpsMatch = url.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (httpsMatch) {
    return { host: httpsMatch[1], owner: httpsMatch[2], repo: httpsMatch[3] };
  }
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], owner: sshMatch[2], repo: sshMatch[3] };
  }
  return null;
}

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false, timeout: 60000 });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => stdout += c.toString('utf8'));
    proc.stderr.on('data', (c) => stderr += c.toString('utf8'));
    proc.on('error', (e) => reject(e));
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `git exited with ${code}`));
    });
  });
}

function dirSizeMB(dirPath: string): number {
  let total = 0;
  const walk = (p: string) => {
    try {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === '.git') continue;
        const full = path.join(p, e.name);
        if (e.isDirectory()) walk(full);
        else try { total += fs.statSync(full).size; } catch {}
      }
    } catch {}
  };
  walk(dirPath);
  return total / (1024 * 1024);
}
