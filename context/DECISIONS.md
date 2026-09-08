# DECISIONS.md — Architecture Decision Log

Append-only. Newest at top.

---

## D-2026-09-08-001 — Single-page architecture under `/`

- **Decision:** All 17 navigation sections render as views inside `src/app/page.tsx`
  with client-side view switching via a Zustand store.
- **Reason:** Platform skill requires the user-facing surface to be only the
  `/` route; routing outside `/` is not user-visible.
- **Trade-off:** All views share one bundle. Mitigated by code-splitting per
  view with `React.lazy` and only mounting the active view.

## D-2026-09-08-002 — Socket.io mini-service on port 3003 for process logs

- **Decision:** A separate bun+socket.io service at `mini-services/proc-ws`
  emits log/status events. Clients connect via `io("/?XTransformPort=3003")`.
- **Reason:** Platform skill mandates socket.io in a mini-service and Caddy
  already routes `XTransformPort=3003` to localhost:3003.

## D-2026-09-08-003 — OSV.dev primary + NVD by CVE ID

- **Decision:** Use OSV.dev for package-name queries; NVD for CVE-ID queries.
- **Reason:** OSV is Tier-1, free, no key; NVD is authoritative for CVE
  metadata. Cache both with freshness.

## D-2026-09-08-004 — Docker runner reports "DOCKER UNAVAILABLE"

- **Decision:** When Docker is not detected, the DockerRunner reports
  `DOCKER_UNAVAILABLE` instead of being silently skipped.
- **Reason:** Never hide capability gaps from the user.

## D-2026-09-08-005 — Spawn with argv, never shell string

- **Decision:** The runner uses `child_process.spawn(exe, args, { cwd, env,
  stdio })` and never `exec(string)` or `bash -c`.
- **Reason:** Eliminates shell-injection surface.

## D-2026-09-08-006 — AI output is always `AI_INTERPRETATION`

- **Decision:** Any LLM-derived suggestion in the UI carries the
  `AI_INTERPRETATION` label and is never executed without passing the same
  command policy as user commands.
- **Reason:** AI hallucination is a real threat; labelling + policy gates
  prevent harm.
