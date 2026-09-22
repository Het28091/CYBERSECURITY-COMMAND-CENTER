# Spiral 26 — Premium Ambient 3D + Full CSS Overlap Remediation

**Spiral:** 26
**Date:** 2026-09-09
**Status:** COMPLETE

## What Changed

### 1. Verification Page Overlap Fix

- **Root cause:** TopBar used `sticky top-0` with `backdrop-blur-md` and translucent `bg-surface-1/80`. Content scrolled under the header and was visible through the blur, causing a visual overlap.
- **Fix:** Removed `sticky top-0` and `backdrop-blur-md` from TopBar. Changed to opaque `bg-surface-1` with `shrink-0` to prevent flex compression. The header is now a solid, non-translucent bar.

### 2. Giant 3D Topology Replaced with Ambient Background

- **Removed:** The large interactive 3D topology widget that sat between KPI tiles and dashboard content (from Spiral 25). It was too large, displayed 114 project labels, and dominated the page.
- **Added:** `Ambient3DBackground` component — a `position:fixed`, `pointer-events:none`, `z-index:0` background layer that renders:
  - Two slowly-rotating translucent torus rings (abstract orbital structures)
  - 12 sparse floating nodes (no labels, no data, no text)
  - A subtle wireframe sphere (system boundary representation)
  - Very slow auto-rotation (0.03 rad/s)
- **Not a content block:** The 3D is behind ALL app content. It does not push content, intercept clicks, or display data. App content sits at `z-index: 1`.
- **Fallback:** CSS gradient mesh when WebGL unavailable or `prefers-reduced-motion: reduce`.
- **Performance:** `dpr: [1,1]`, `antialias: false`, `powerPreference: low-power`, 12 nodes max.
- **Accessibility:** `aria-hidden="true"` — invisible to assistive technology.

### 3. Full Route Audit — ALL 20 Views Browser-Tested

Every view from the source code's `ViewRouter` switch was tested via browser automation:
- 19 navigation views + 1 project detail view = 20 total
- 21 screenshots captured in `artifacts/ui/spiral-26/`
- 0 console errors (1 Three.js deprecation warning — cosmetic)
- 0 page errors
- 0 overlap issues (after fix)

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Lint | 1 | PASS (0 errors) |
| Security tests | 13 | 13/13 PASS |
| Adversarial tests | 19 | 19/19 PASS |
| Redaction tests | 7 | 7/7 PASS |
| Backup tests | 7 | 7/7 PASS (no restart) |
| Security suite | 18 | 18/18 PASS |
| Session revocation | 15 | 15/15 PASS |
| Auth audit | 38 | 38/38 PASS |
| Browser (20 views) | 20 | 20/20 PASS (0 errors) |
| **Total** | **118** | **118/118 PASS (100%)** |

## Artifacts

- `artifacts/ui/spiral-26/` — 21 screenshots (all 20 views + verification-before)
- `artifacts/ui/spiral-26/report.json` — machine-readable audit
- `artifacts/ui/spiral-26/report.md` — human-readable report
- `src/components/cyber/3d/Ambient3DBackground.tsx` — ambient 3D component
