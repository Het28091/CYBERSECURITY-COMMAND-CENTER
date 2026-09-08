# TECHNOLOGY_DECISIONS.md — Cybersecurity Command Center

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## Decision Record Format

Each entry: **Decision**, **Alternatives**, **Rationale**, **Trade-offs**.

## TD-001 — Framework: Next.js 16 (App Router) + TypeScript

- **Alternatives:** Express + Vite SPA; Remix; SvelteKit; Nuxt.
- **Rationale:** Required by the platform skill. TypeScript gives compile-time
  safety on security-critical modules (path safety, command policy).
- **Trade-offs:** Larger framework than Express, but the App Router gives us
  API routes co-located with the UI and a clear server-only boundary.

## TD-002 — Database: Prisma + SQLite

- **Alternatives:** better-sqlite3 raw; LowDB; Postgres.
- **Rationale:** Local-first, zero-ops, transactional, with a clean schema DSL.
  Migrations keep schema changes auditable.
- **Trade-offs:** Not designed for concurrent multi-user writes — acceptable
  for the single-user local-first target.

## TD-003 — UI Library: shadcn/ui (New York) + Tailwind 4

- **Alternatives:** Mantine; Chakra UI; Material UI; custom CSS.
- **Rationale:** Pre-installed. Accessible (Radix primitives). Dark-first
  theming works out of the box. New York style fits a cybersecurity aesthetic.
- **Trade-offs:** Slightly more verbose than Mantine, but the copy-in
  component model lets us tune anything.

## TD-004 — State: Zustand + TanStack Query

- **Alternatives:** Redux Toolkit; Jotai; pure React context.
- **Rationale:** Zustand is tiny and ergonomic for client nav state; TanStack
  Query handles server-state caching, retries, and invalidation.
- **Trade-offs:** Two libraries instead of one, but they have non-overlapping
  responsibilities.

## TD-005 — Real-Time: Socket.io mini-service on port 3003

- **Alternatives:** SSE on the main port; long polling; native WebSocket in
  Next.js.
- **Rationale:** The platform skill mandates socket.io for real-time and
  requires a separate mini-service. The Caddyfile already proxies the
  `XTransformPort=3003` query.
- **Trade-offs:** Extra process to manage; offset by hot reload (`bun --hot`).

## TD-006 — Vulnerability Source: OSV.dev (primary) + NVD (by CVE ID)

- **Alternatives:** GitHub Security Advisories API (requires token); Snyk
  (commercial); vulners.com (commercial).
- **Rationale:** OSV.dev is free, Tier-1, public, covers many ecosystems, and
  does not require an API key. NVD is the authoritative source for CVE details.
- **Trade-offs:** Rate limits on NVD (mitigated by caching + freshness labels).

## TD-007 — OWASP Knowledge: Linked, not embedded

- **Alternatives:** Scraping full OWASP pages; embedding full text.
- **Rationale:** Embedding full text risks staleness and copyright issues. We
  seed short summaries with an authoritative source URL, version label, and
  verification status, and the UI links out to the official page.
- **Trade-offs:** Less content offline, but every entry is clearly sourced and
  freshness-labelled.

## TD-008 — Compliance: Catalogue, not certification

- **Alternatives:** Claim compliance per framework; auto-map to controls.
- **Rationale:** The platform instruction explicitly forbids claiming legal
  compliance. We provide a control catalogue with applicability labels and a
  prominent disclaimer on every compliance page.
- **Trade-offs:** The user still needs a real auditor; we make their job
  easier, not redundant.

## TD-009 — Runner: spawn with argv, never shell string

- **Alternatives:** `exec(command)`; `bash -c`.
- **Rationale:** Shell-string concatenation is the single largest source of
  command injection. `spawn(exe, args, { cwd, env })` avoids shell
  interpretation entirely.
- **Trade-offs:** Slightly more verbose to construct argv; pipelines need
  explicit handling. Acceptable — pipelines are uncommon in project run
  commands and we add them only via an explicit, validated helper.

## TD-010 — AI Integration: z-ai-web-dev-sdk server-only

- **Alternatives:** OpenAI direct; Anthropic direct; no AI.
- **Rationale:** Platform provides the SDK. Used server-side only for README
  summarisation and command suggestion. AI output is always labelled
  `AI_INTERPRETATION` and never executed without passing the same command
  policy as user commands.
- **Trade-offs:** AI hallucinations are a real risk; mitigated by mandatory
  cross-check and confidence floor.
