# PROJECT_RUNNER_SPEC.md

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Abstract Runner

```ts
interface ProjectRunner {
  readonly id: string;        // 'node' | 'python' | 'docker' | ...
  readonly displayName: string;
  readonly supported: boolean; // false when runtime not installed
  detect(projectPath: string): Promise<RunnerDetection>;
  buildCommand(project: Project, action: RunAction): ResolvedCommand | null;
}
```

`ResolvedCommand`:
```ts
{
  executable: string;     // canonical
  args: string[];         // argv
  cwd: string;            // canonical project path
  env: Record<string,string>;
  timeoutMs: number;
  source: 'manifest' | 'readme' | 'user' | 'ai';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  evidence: string[];     // files / lines that justify this command
}
```

## 2. Implemented Runners

| Runner | Detects via | Default action |
|--------|-------------|----------------|
| NodeRunner | `package.json` scripts (`dev`, `start`) | `npm run dev` or `npm start` |
| PythonRunner | `pyproject.toml`, `requirements.txt`, `app.py`/`main.py` | `python <entry>` |
| DockerRunner | `Dockerfile`, `compose.yml` | `docker compose up` (reports DOCKER_UNAVAILABLE when missing) |
| ShellRunner | `Makefile`/`run.sh` | `make run` or `./run.sh` |
| GoRunner | `go.mod` | `go run .` (reports RUNTIME_NOT_INSTALLED when missing) |
| RustRunner | `Cargo.toml` | `cargo run` (reports RUNTIME_NOT_INSTALLED when missing) |

## 3. Execution Policy

1. Resolve command via runner. If none, refuse with `NO_RUNNER`.
2. Validate executable against allow-list.
3. Scan args against block-list tokens (regex on argv joined with spaces).
4. Resolve cwd to canonical project path.
5. If `dryRun`, return the resolved command without executing.
6. Otherwise spawn with `child_process.spawn(exe, args, { cwd, env, stdio })`.
7. Track pid. Stream stdout/stderr to log table + WS service.
8. Apply timeout; on timeout send SIGTERM, wait grace, then SIGKILL.
9. On `stop` request: SIGTERM, grace, SIGKILL.
10. Record `ProjectExecution` row.

## 4. Block-list (subset)

- `rm -rf /`, `rm -rf ~`, `rm -rf *`
- `dd if=`, `mkfs`, `> /dev/sd`, `> /dev/nvme`
- `chmod -R 777 /`, `chown -R`
- `sudo`, `su`, `doas`
- `curl | sh`, `wget | sh`, `curl | bash`, `wget | bash`
- `:(){:|:&};:`
- `bash -i`, `sh -i`, `nc -l`, `nc -e`
- `python -c 'import os; os.system` (and similar one-liners)
- `eval`, `exec` in shell contexts

## 5. Allow-list (initial, configurable in Settings)

```
node, npm, npx, yarn, pnpm, bun
python, python3, pip, pipenv, poetry, uv
go, cargo, rustc, ruby, bundle, gem, rake
java, javac, mvn, gradle
make, docker, docker-compose
git, curl, wget  (allowed but with arg block-list checks)
```

`curl`/`wget` args that include `|` or `-o /dev/` are blocked.
