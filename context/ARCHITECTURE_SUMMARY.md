# ARCHITECTURE_SUMMARY.md

Single-page Next.js 16 + TS app at `/` with sidebar nav switching between 17
views. Backend = Next.js API routes + Prisma/SQLite + server-only modules in
`src/lib/cyber/`. Real-time = Socket.io mini-service on port 3003 (proxied
via Caddy `XTransformPort=3003`). External = OSV.dev + NVD with caching and
freshness tracking. No fabrication: `UNKNOWN` / `UNVERIFIED` / `STALE` /
`NO DATA AVAILABLE` everywhere data is missing. Audit trail is append-only.
Path safety + command policy + secret redaction are the three security
pillars of the runner.
