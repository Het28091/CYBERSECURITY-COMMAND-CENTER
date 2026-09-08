# DEPLOYMENT_MODEL.md

**Version:** 1.0  **Date:** 2026-09-08  **Spiral:** 0

## 1. Local Development Mode

- `bun run dev` (auto-started by the platform).
- Caddy proxies external :81 → localhost:3000, with `XTransformPort=3003`
  for the WS mini-service.
- All bind addresses are localhost by default.

## 2. Local Production Mode

- `bun run build` (forbidden in this sandbox per platform skill; documented
  for completeness).
- `bun run start` runs the standalone server.

## 3. Container Deployment

Documented but not used in this sandbox (Docker not installed).

## 4. Reproducibility

- `package.json` + `bun.lock` pin all dependencies.
- Prisma schema in `prisma/schema.prisma`.
- Seed scripts in `scripts/`.

## 5. External Network Exposure

- Default: no exposure beyond the local Caddy proxy.
- The user is responsible for any additional exposure; the app warns if the
  bind is changed from localhost.
