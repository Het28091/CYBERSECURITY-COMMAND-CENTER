# UI Design System — Cybersecurity Command Center

**Version:** 1.0 (Spiral 24)
**Date:** 2026-09-09

## Design Principles

1. **Dark-first premium workstation** — the interface feels like a security operations center, not a generic admin panel.
2. **Information density without clutter** — security engineers need dense data, but it must remain scannable.
3. **Severity via structure, not just color** — every status indicator uses icon + label + color (never color alone).
4. **Surface hierarchy** — 4 levels of elevation (surface-0 deepest → surface-3 most raised) create depth without heavy shadows.
5. **Subtle illumination** — glow effects are minimal and functional (indicating active/important state, not decoration).
6. **Reduced-motion respect** — all animations respect `prefers-reduced-motion: reduce`.
7. **3D as enhancement, not dependency** — critical information never depends on WebGL.

## Typography

| Role | Class | Size | Weight | Tracking | Usage |
|------|-------|------|--------|----------|-------|
| Display | `.cyber-display` | 1.25rem+ | 600 | -0.02em | Page titles |
| Metric | `.cyber-metric` | 1.75rem | 600 | -0.03em | KPI numbers |
| Label | `.cyber-label` | 0.6875rem | 500 | 0.06em uppercase | Section labels, field labels |
| Mono | `.cyber-mono` | 0.8125rem | 400 | -0.01em | Code, paths, CVE IDs, timestamps |
| Body | default | 0.875rem | 400 | 0 | General text |

## Color System

### Surfaces (dark theme)
| Token | Value | Usage |
|-------|-------|-------|
| `--surface-0` | oklch(0.11) | Deepest background, app shell |
| `--surface-1` | oklch(0.14) | Sidebar, base panels |
| `--surface-2` | oklch(0.16) | Cards, elevated panels |
| `--surface-3` | oklch(0.18) | Hover state, modals, dropdowns |

### Edges
| Token | Value | Usage |
|-------|-------|-------|
| `--edge` | oklch(white 8%) | Standard borders |
| `--edge-subtle` | oklch(white 4%) | Subtle dividers |

### Severity (with icons)
| Level | Color | Icon | Pattern |
|-------|-------|------|---------|
| Critical | red oklch(0.58 0.26 27) | ShieldAlert | Solid bar |
| High | orange oklch(0.68 0.22 41) | ShieldAlert | 4/5 bar |
| Medium | amber oklch(0.78 0.17 70) | AlertTriangle | 3/5 bar |
| Low | blue oklch(0.60 0.14 220) | Shield | 2/5 bar |
| Info | slate oklch(0.58 0.02 240) | Info | 1/5 bar |

### Signals
| Signal | Color | Usage |
|--------|-------|-------|
| OK | green oklch(0.66 0.16 145) | Healthy, verified, available |
| Warn | amber oklch(0.78 0.17 70) | Degraded, stale, warning |
| Fail | red oklch(0.58 0.26 27) | Failed, unhealthy, blocked |
| Idle | slate oklch(0.60 0.02 240) | Unknown, idle, pending |

### Primary accent
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | oklch(0.72 0.14 200) | Cyan-teal accent for interactive elements |
| `--glow-primary` | oklch(primary / 6%) | Subtle glow on hover/active |

## Spacing

Based on 4px grid:
- `gap-1` = 4px (tight)
- `gap-2` = 8px (compact)
- `gap-3` = 12px (default)
- `gap-4` = 16px (comfortable)
- `gap-6` = 24px (section spacing)

## Z-index System

| Class | Z-index | Usage |
|-------|---------|-------|
| `.cyber-z-sidebar` | 40 | Navigation sidebar |
| `.cyber-z-header` | 35 | Top bar |
| `.cyber-z-dropdown` | 45 | Dropdowns, popovers |
| `.cyber-z-modal` | 50 | Dialogs, modals |
| `.cyber-z-command-palette` | 55 | Command palette overlay |
| `.cyber-z-toast` | 60 | Toast notifications |

## 3D Approach

- **Command Center**: A 3D security topology canvas showing project nodes, health signals, and threat indicators. Uses CSS 3D transforms (not WebGL) for maximum compatibility.
- **Fallback**: When 3D is not available or reduced-motion is active, show a 2D grid layout with the same data.
- **Performance**: 3D is CSS-based (transform/transition), not canvas/WebGL — no GPU overhead.
- **Mobile**: 3D elements collapse to 2D on viewports < 768px.

## Animation Rules

| Do | Don't |
|----|-------|
| Subtle hover depth (translateY -1px) | Constant motion |
| State-change transitions (0.15s) | Excessive parallax |
| Pulse for live indicators (2.5s) | Animation of critical data |
| Progress indicators | Seizure-triggering effects |
| Modal fade-in | Distracting particles |

All animations respect `prefers-reduced-motion: reduce`.

## Component Patterns

### Cards
- `cyber-surface-2` background
- `cyber-edge` border (1px, subtle)
- `cyber-card-hover` for interactive cards
- Rounded `--radius` (0.5rem)

### Status Pills
- Inline-flex, font-mono, small (10-11px)
- Icon + label + color (never color alone)
- Severity bars for visual weight

### Tables
- `cyber-mono` font for data
- Subtle row hover (`--surface-3`)
- Sticky headers where appropriate

### Terminal/Logs
- `cyber-mono` font
- Monospace timestamp prefix
- Stream color coding (stdout=blue, stderr=red, event=amber)
- Copy button
- No wrapping for long lines (horizontal scroll)

## Responsive Rules

| Breakpoint | Behavior |
|------------|----------|
| ≥ 1024px | Full sidebar + 3D + dense layout |
| 768-1023px | Collapsible sidebar + 2D fallback |
| < 768px | Drawer sidebar + stacked layout + no 3D |

## Accessibility

- All interactive elements: keyboard reachable, visible focus ring
- ARIA labels on icon-only buttons
- Status indicators: icon + color + label (never color alone)
- `prefers-reduced-motion: reduce` → disable all animations
- Semantic HTML: `<main>`, `<nav>`, `<header>`, `<section>`
- Screen reader text: `.sr-only` class for hidden labels
