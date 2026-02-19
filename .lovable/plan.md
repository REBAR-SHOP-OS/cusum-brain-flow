
# Investigation: "Size" Field Empty on `/shopfloor/station/[id]`

## What Was Found

### Complete Audit of All "Size" Fields Across Shopfloor

After reading every relevant file in `src/components/shopfloor/`, `src/pages/StationView.tsx`, `src/hooks/useStationData.ts`, and supporting components, here is every place "Size" is displayed on the station page:

| Component | Label | Value Expression | Fallback |
|---|---|---|---|
| `ProductionCard.tsx` line 153 | "Size" | `{item.bar_code}` | `"—"` via `\|\| "—"` |
| `BenderStationView.tsx` line 228 | "Bar Size" | `{currentItem.bar_code}` | none |
| `CutEngine.tsx` line 101 | "Bar Size" | `{barCode}` | none |

### Root Cause

The "Size" display in `ProductionCard.tsx` uses `{item.bar_code || "—"}`, which correctly shows a dash when `bar_code` is falsy. However, **`BenderStationView.tsx` (line 229) and `CutEngine.tsx` (line 101) render `bar_code` with NO fallback guard**. If `bar_code` is an empty string `""` (which is falsy but doesn't trigger `|| "—"`), the field renders visually blank.

More critically: the **bender query** in `useStationData.ts` (line ~57) fetches items using a joined select:

```ts
.select("*, cut_plans!inner(id, name, project_name, company_id)")
```

The `bar_code` column comes from `cut_plan_items` directly — but the `phase` filter `.or("phase.eq.cut_done,phase.eq.bending")` and the mapping code at line ~69 spreads `...item` which includes `bar_code`. This is correct and should work.

The most likely cause for a visually blank "Size" field: the `bar_code` value in the database record is an **empty string `""`** rather than `null`. With `{currentItem.bar_code}` (no fallback), an empty string renders as nothing visible.

### The Fix — Two Files, Surgical Only

**1. `src/components/shopfloor/BenderStationView.tsx` — line 229**

Add a fallback `|| "—"` to the bar_code display:

Before:
```tsx
<p className="text-2xl sm:text-3xl font-black text-foreground">{currentItem.bar_code}</p>
```

After:
```tsx
<p className="text-2xl sm:text-3xl font-black text-foreground">{currentItem.bar_code || "—"}</p>
```

**2. `src/components/shopfloor/CutEngine.tsx` — line 101**

Add a fallback to the Bar Size display in the CutEngine panel:

Before:
```tsx
<p className="text-lg font-black font-mono">{barCode}</p>
```

After:
```tsx
<p className="text-lg font-black font-mono">{barCode || "—"}</p>
```

**3. `src/hooks/useStationData.ts` — defensive mapping**

Add an explicit `bar_code` check in the bender item mapping (line ~69–74) to ensure empty strings are normalized:

Before:
```ts
return (items || []).map((item: Record<string, unknown>) => ({
  ...item,
  ...
})) as StationItem[];
```

After:
```ts
return (items || []).map((item: Record<string, unknown>) => ({
  ...item,
  bar_code: (item.bar_code as string) || "",
  ...
})) as StationItem[];
```

### Scope

| File | Line | Change |
|---|---|---|
| `src/components/shopfloor/BenderStationView.tsx` | 229 | Add `\|\| "—"` fallback to bar_code display under "Bar Size" label |
| `src/components/shopfloor/CutEngine.tsx` | 101 | Add `\|\| "—"` fallback to barCode display under "Bar Size" label |

### What Is NOT Changed
- `ProductionCard.tsx` — already has `\|\| "—"` fallback, untouched
- `useStationData.ts` data fetching queries — untouched
- Database schema — untouched
- Any other component, page, logic, or route
