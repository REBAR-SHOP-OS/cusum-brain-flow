# Dual-Path Cut Math — Imperial vs Metric (no DB rename)

## Goal
Fix the **125 pcs/bar instead of 5** bug for imperial items by routing all cut-math through unit-locked modules. The misleading `cut_length_mm` column **stays** — values are interpreted using each row's existing `unit_system`.

## Files

### NEW
- `src/lib/cutMath/imperial.ts` — pure inch math (`piecesPerBarImperial`, `computeRunPlanImperial`, `formatLengthImperial`, `weightKgImperial`, `REMNANT_THRESHOLD_IN = 12`).
- `src/lib/cutMath/metric.ts` — pure mm math (`piecesPerBarMetric`, `computeRunPlanMetric`, `formatLengthMetric`, `weightKgMetric`, `REMNANT_THRESHOLD_MM = 300`).
- `src/lib/cutMath/index.ts` — dispatcher: `isImperial(unit)` picks the right module. Functions: `piecesPerBar`, `computeRunPlan`, `formatLength`, `weightKg`, `remnantThreshold`. **Never converts between units.**
- `src/lib/cutMath/imperial.test.ts` — asserts 480"/96" → 5 pcs (the regression), remnant flagging at 12", formatter cases (`8'`, `5'-6"`, `6½"`).
- `src/lib/cutMath/metric.test.ts` — asserts 12000mm/1524mm → 7 pcs, threshold = 300 mm.

### EDITED
- **`src/lib/foremanBrain.ts`**
  - Add `unit_system?: string` on `ForemanContext` (read from `currentItem.unit_system`).
  - Replace inline `Math.floor(stockMm/cutMm)`, `REMNANT_THRESHOLD_MM`, and the local `computeRunPlan` with calls into `cutMath/index.ts` using `unit_system`.
  - `lengthLabel(item)` → `item.source_total_length_text || formatLength(item.cut_length_mm, item.unit_system)`.
  - Stock-source resolution (lots/floor/remnants) compares using the `cut_length_mm` value as-is; that's already in the same unit as the inventory rows for that bar code (no cross-unit comparison was happening before — the bug was just the divisor).
  - Step-2 instruction stops printing `${ctx.selectedStockLength / 1000}M` and instead uses `formatLength(ctx.selectedStockLength, item.unit_system)`.

- **`src/components/shopfloor/CutterStationView.tsx`**
  - Remove the local `REMNANT_THRESHOLD_MM = 300`; use `remnantThreshold(currentItem.unit_system)`.
  - Default `selectedStockLength` becomes unit-aware: imperial → `480` (40' = 480"), metric → `12000` (mm). Initialised inside an effect that fires when `currentItem.unit_system` first becomes known.
  - All `selectedStockLength - slot.cutsDone * currentItem.cut_length_mm` math stays — it's already same-unit. Only the threshold comparison changes (uses dispatcher).
  - `computedPiecesPerBar` fallback uses `piecesPerBar(selectedStockLength, currentItem.cut_length_mm, currentItem.unit_system)`.
  - Toast/notes strings call `formatLength(value, unit_system)` instead of hard-coding `mm`.
  - Pass `displayUnit={isImperial(currentItem.unit_system) ? "imperial" : "metric"}` to `<CutEngine>` (replaces the existing `source_total_length_text` regex sniff).

- **`src/components/shopfloor/CutEngine.tsx`**
  - Stock-length picker becomes unit-aware. When `displayUnit === "imperial"`, options are `[240, 480, 720]` (20'/40'/60') and labels are `"20'" "40'" "60'"`. When metric, current `[6000, 12000, 18000]` / `"6M" "12M" "18M"`.
  - Default selected stock matches unit (`480` vs `12000`).
  - `remnantMm`/`lastRemnantMm` props/labels become `remnantValue` and use the displayUnit's symbol.

- **`src/hooks/useStationData.ts`**
  - Add `unit_system: string | null` to the `StationItem` interface (column already exists in `cut_plan_items`).
  - Map it through in both bender and cutter result transforms (`unit_system: item.unit_system ?? null`).

- **`src/lib/cutLengthDisplay.ts`** — keep current behaviour (already source-text-first), but route the numeric fallback through `formatLength(raw, unit_system)` from the dispatcher so the two pipelines share one formatter.

- **`src/lib/foremanBrain.test.ts`**
  - Add `unit_system: "in"` (or `"mm"`) to `makeItem` defaults; add a new test asserting that an imperial item with `cut_length_mm = 96`, `selectedStockLength = 480` produces `runPlan.piecesPerBar === 5`.
  - Existing metric tests get `unit_system: "metric"` explicitly.

## Out of scope (deliberate)
- DB column rename (`cut_length_mm` stays).
- Touching readers/writers that don't do math (packing slips, BOM tables, ZPL renderer) — they already pass `cut_length_mm` straight through and read `source_total_length_text` for display.
- Edge functions — none of them compute `pieces_per_bar`; they only persist values.

## Validation
- `bunx vitest run src/lib/cutMath src/lib/foremanBrain.test.ts` → green.
- `/shopfloor/station/…` mark **A1502 (8' on 40' stock, `unit_system="in"`)** → **PCS/BAR = 5**, last bar = 4 if 49 remaining, remnant 0".
- A metric item (`cut_length_mm=1524`, `unit_system="metric"`, stock 12000 mm) → 7 pcs/bar, 1332 mm flagged as remnant.

## Order of work
1. Create `cutMath/` modules + tests (additive, zero risk).
2. Add `unit_system` to `StationItem` and pass through `useStationData`.
3. Wire the dispatcher into `foremanBrain.ts` + tests.
4. Make `CutterStationView` and `CutEngine` unit-aware.
5. Manual smoke on the failing route.
