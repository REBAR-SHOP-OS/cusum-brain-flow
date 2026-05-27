# Shop Floor — extend industrial chrome to every tab

## Why

The Hub (`/shop-floor`) now renders inside `ShopFloorChrome` (dark `.industrial` theme, teal top rule, sticky tab strip, `WorkspaceHeader`). The sub-routes (`/shopfloor/station`, `pool`, `clearance`, `loading`, `pickup`, `cutter`, `delivery-ops`, `inventory`, `camera-intelligence`) still render with the global light theme and no tab strip — so clicking any tab drops the operator out of the industrial look (screenshot 1 vs reference screenshot 2).

Goal: every shop-floor route renders inside the same chrome with a consistent header + tab strip, matching the REBAR OS Core reference.

## Scope (additive only)

- No route changes, no logic changes, no hook changes.
- Pure presentational wrap: each page's existing JSX moves inside a `<ShopFloorChrome>` wrapper.
- No edits to shared components, hooks, queries, or RLS.

## Pages to wrap

| Page file | Route | Header title | Eyebrow |
|---|---|---|---|
| `src/pages/StationDashboard.tsx` | `/shopfloor/station` | Stations | Live Operations |
| `src/pages/PoolView.tsx` | `/shopfloor/pool` | Material Pool | Staging & Flow |
| `src/pages/ClearanceStation.tsx` | `/shopfloor/clearance` | Clearance | QC & Evidence |
| `src/pages/LoadingStation.tsx` | `/shopfloor/loading` | Loading Station | Load & Evidence |
| `src/pages/PickupStation.tsx` | `/shopfloor/pickup` | Pickup Station | Customer Collection |
| `src/pages/CutterPlanning.tsx` | `/shopfloor/cutter` | Cutter Plan | Cut list & queue |
| `src/components/shopfloor/InventoryCountView.tsx` (page wrapper) | `/shopfloor/inventory` | Inventory | Counts & Adjustments |
| `src/pages/DeliveryOps.tsx` | `/shopfloor/delivery-ops` | Delivery Ops | Dispatch & Drop-off |
| `src/pages/CameraIntelligence.tsx` | `/shopfloor/camera-intelligence` | Camera AI | Vision & Dispatch |

`StationView.tsx` (`/shopfloor/station/:machineId`), `DeliveryTerminal.tsx`, `DeliveryPipeline.tsx` are operator/detail views — out of scope for this pass (they have their own back-nav header).

## Per-page change pattern

For each page, the change is a two-line wrap. Example for `StationDashboard.tsx`:

```text
return (
  <ShopFloorChrome
    eyebrow="Live Operations"
    title="Stations"
    subtitle="Released work, active stations, and handoff state across the floor."
  >
    {/* existing JSX unchanged */}
  </ShopFloorChrome>
);
```

- Any existing top-of-page hero / title block inside the page (e.g. `Shop Floor — Live Operations` banner already inside `StationDashboard`) is removed because `WorkspaceHeader` replaces it. This is the only deletion — pure de-duplication, not a refactor.
- Top-level `<div className="min-h-screen bg-…">` wrappers in each page are removed (the chrome's `IndustrialFrame` already provides full-height dark background). Removing them prevents the light-theme leak shown in screenshot 1.

## Verification

1. `bunx tsc --noEmit` — must stay clean.
2. Open `/shopfloor/station` — should show the same dark theme, tab strip (Stations active), and `Shop Floor → Stations` header as screenshot 2.
3. Click each tab — chrome stays mounted, only the body swaps.
4. Existing functionality (filters, machine grid, ticker, refresh buttons, project switcher, batch list, photo feedback, pin) must continue to work — verified by spot-checking each page after wrap.

## Out of scope

- No new features (no Supervisor sheet, no QR scanner wiring, no live ops ticker port).
- No data layer changes.
- Detail views (`StationView`, `DeliveryTerminal`, `DeliveryPipeline`).
- Mobile layout tuning beyond what the chrome already provides.

## Cleanup checklist (after wrap)

- Remove now-unused imports from each page (e.g. duplicated `ArrowLeft` back-buttons, redundant `brandLogo` headers if they were only used for the old top bar).
- Re-read each touched file to confirm no leftover light-theme wrappers or dead title blocks remain.
- Report: files touched, dead code removed, remaining risks.
