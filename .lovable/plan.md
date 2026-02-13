

# Audit and Improve: Optimization Engine + View

## Issues Found

### Engine (`cutOptimizer.ts`)

1. **Oversized pieces silently dropped** -- any piece longer than stock length is skipped with no warning. The user has no idea data was lost.
2. **No kerf (blade width) allowance** -- real saws consume 3-5mm per cut. Current math assumes zero-width cuts, making efficiency numbers optimistic and plans that fail on the floor.
3. **No minimum remainder threshold** -- a 50mm offcut is scrap, not a usable remnant. The engine doesn't distinguish between usable remnants and waste.
4. **Standard mode doesn't group same-length pieces** -- stopper moves are unnecessarily high because pieces aren't sorted by length before sequential packing.
5. **Only First Fit Decreasing** -- no Best Fit Decreasing option (finds the tightest-fitting bar, not just the first one with space), which often produces less waste.

### View (`OptimizationView.tsx`)

6. **"Apply Plan" is fake** -- `handleApplyPlan` does a 1.2s `setTimeout` and shows a toast. Nothing is persisted to the database.
7. **Inconsistent header** -- says "Supervisor Hub" instead of "Optimization" once a session is selected.
8. **No skipped-pieces warning** -- if oversized pieces are filtered out, the user sees fewer items with no explanation.
9. **No empty-state when all rows are filtered** -- if every row has null length/quantity, the loader spins forever because results stay null.
10. **Breakdown defaults to standard when no plan is selected** -- confusing because the user hasn't chosen yet but sees standard data.
11. **Missing `displayName` and `forwardRef`** -- both `OptimizationView` and `PlanCard` lack these per project component standards.

---

## Plan

### 1. Engine Improvements (`cutOptimizer.ts`)

- **Add kerf parameter** (default 5mm). Subtract kerf from available space after each cut placement.
- **Track skipped (oversized) pieces** and return them in results so the UI can warn.
- **Add remnant threshold** (default 300mm). Remainders below this are classified as "scrap" vs "usable remnant" in the result.
- **Sort standard-mode pieces by length** to reduce stopper moves while keeping sequential packing.
- **Add Best Fit Decreasing** as a third mode option -- finds the bar with the least remaining space that still fits the piece.
- **Add `totalScrapKg` and `totalRemnantKg`** to the summary for clearer waste breakdown.

### 2. View Fixes (`OptimizationView.tsx`)

- **Fix header** to say "Optimization" consistently.
- **Add skipped-pieces banner** -- if any pieces exceed stock length, show an amber warning with count and details.
- **Fix empty-state** -- if cutItems is empty after filtering, show a message instead of infinite loader.
- **Default breakdown to optimized** (the recommended plan) when no plan is selected yet.
- **Add `displayName`** to both `OptimizationView` and `PlanCard`.
- **Show kerf setting** next to stock length selector (small input, default 5mm).
- **Show waste breakdown** -- split "Net Waste" in PlanCard into "Scrap" and "Usable Remnants".

### 3. Persist "Apply Plan" to Database

- Create a `cut_plans` table (if not existing) or use existing structure to save the selected plan.
- Replace the fake `setTimeout` with an actual insert of the optimization result linked to the session.

---

## Technical Details

### File: `src/lib/cutOptimizer.ts`

**New parameters and types:**

```typescript
export interface OptimizerConfig {
  stockLengthMm: number;
  kerfMm: number;           // default 5
  minRemnantMm: number;     // default 300
  mode: "standard" | "optimized" | "best-fit";
}

// Add to OptimizationResult
skippedPieces: { mark: string; lengthMm: number }[];
usableRemnantCount: number;
scrapCount: number;
```

**Kerf logic** -- after placing a piece, subtract `piece.lengthMm + kerfMm` from remainder (except for the last piece on a bar where no kerf is needed after it).

**Best Fit Decreasing** -- new function that sorts descending like FFD but picks the bar with the smallest `remainderMm` that still fits the piece.

**Standard mode** -- sort pieces by length before sequential packing to group same-length cuts and reduce stopper moves.

### File: `src/components/office/OptimizationView.tsx`

**Skipped pieces warning:**
```tsx
{skippedCount > 0 && (
  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
    <AlertTriangle className="w-5 h-5 text-amber-500" />
    <p className="text-sm text-amber-200">
      {skippedCount} pieces exceed {stockLength/1000}M stock -- skipped from optimization
    </p>
  </div>
)}
```

**Kerf input** next to stock length buttons:
```tsx
<div className="flex items-center gap-1">
  <span className="text-xs text-muted-foreground">Kerf:</span>
  <input type="number" value={kerf} onChange={...} className="w-12 h-8 text-xs" />
  <span className="text-xs text-muted-foreground">mm</span>
</div>
```

**Empty state fix:**
```tsx
if (!rowsLoading && cutItems.length === 0) {
  return <EmptyState message="No valid cut items found in this session." />;
}
```

### Database: `cut_plans` table

```sql
CREATE TABLE IF NOT EXISTS cut_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES extract_sessions(id),
  company_id uuid REFERENCES companies(id),
  mode text NOT NULL,
  stock_length_mm integer NOT NULL,
  kerf_mm integer DEFAULT 5,
  plan_data jsonb NOT NULL,
  total_stock_bars integer,
  total_waste_kg numeric,
  efficiency numeric,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE cut_plans ENABLE ROW LEVEL SECURITY;
```

### Files Modified
- `src/lib/cutOptimizer.ts` -- kerf, remnant threshold, best-fit mode, skipped tracking
- `src/components/office/OptimizationView.tsx` -- UI fixes, kerf input, warnings, persist apply, displayName
- Database migration -- `cut_plans` table for persisting applied plans

