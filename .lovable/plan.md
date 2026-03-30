

# Unit System Audit — Issues Found

## Issues Identified

### Issue 1: 4-Mode Unit System vs 2-Mode Mismatch
The extraction pipeline uses a **4-mode** unit system (`mm`, `in`, `ft`, `imperial`) stored in `extract_sessions.unit_system`. But downstream components (TagsExportView, RebarTagCard, PrintTags) only understand a **2-mode** system (`metric` | `imperial`).

- **TagsExportView** (line 496): passes `(selectedSession as any)?.unit_system || "metric"` to `RebarTagCard` — if the session's unit is `"in"` or `"ft"`, it falls through to the else branch and renders raw mm values, not converted.
- **RebarTagCard** (line 37): only checks `unitSystem === "imperial"` — `"in"` and `"ft"` are treated as metric (raw mm output).
- **PrintTags** (line 14): reads `unit` param from URL — same 2-mode limitation.
- **TagsExportView handlePrint** (line 146): passes `unit_system` to PrintTags URL, which could be `"in"` or `"ft"` — PrintTags doesn't handle these.

### Issue 2: TagsExportView Table — Same 2-Mode Problem
`formatDim()` in TagsExportView (line 31-49) only handles `"imperial"` — if `unit_system` is `"in"` or `"ft"`, dimensions display as raw mm.
The table header (line 387) only checks `=== "imperial"` for the label.

### Issue 3: Mapping Panel Preview Shows Raw DB Values (Not Source Units)
`BarlistMappingPanel` preview table (line 366) displays `row.length` as `String(row.length)`. Per memory, "preview displays raw extracted numeric strings rather than mm-formatted values." This is correct per spec. **No issue here.**

### Issue 4: Weight Calculation Unaffected by Units (Correct)
`getWeight()` always uses `lengthMm` (stored in mm) × `mass_kg_per_m`. This is correct — weight calculation should always use mm internally. **No issue.**

### Issue 5: DetailedListView Only Checks "imperial"
`DetailedListView.tsx` (line 278): dimension sub-label shows `"IN"` only for `unitSystem === "imperial"`, otherwise `"MM"`. Uses `useUnitSystem()` which returns company-level setting (`metric` | `imperial`), not the session's 4-mode unit. This means if a company is metric but a barlist was imported in inches, the detailed list always shows "MM" labels. **Mismatch between session unit and company unit.**

### Issue 6: `generateZpl` — Unknown Unit Handling
The ZPL generator likely has the same 2-mode limitation. Not critical but worth checking during implementation.

---

## Root Cause

Two independent unit systems coexist without a bridge:
1. **Session-level** (4 modes): `mm`, `in`, `ft`, `imperial` — set during extraction
2. **Company-level** (2 modes): `metric`, `imperial` — set in member settings

Display components downstream only understand the 2-mode system.

## Proposed Fix

### Approach: Normalize session unit to display-compatible format

Create a helper function that maps the 4-mode session unit to the display system expected by tags/print:

```text
Session unit → Display mapping:
  "mm"       → "metric"
  "in"       → "metric"    (data already converted to mm in DB)
  "ft"       → "metric"    (data already converted to mm in DB)
  "imperial" → "imperial"  (display as ft-in from mm)
```

**Key insight**: After `applyMapping` runs, ALL values in DB are stored as mm regardless of source unit. The only display question is whether to show mm values as-is ("metric") or convert mm→ft-in for display ("imperial").

### Files to Change

1. **`src/lib/unitSystem.ts`** — Add `sessionUnitToDisplay(sessionUnit: string): "metric" | "imperial"` helper
2. **`src/components/office/TagsExportView.tsx`** — Use `sessionUnitToDisplay()` instead of raw `session.unit_system`
3. **`src/components/office/RebarTagCard.tsx`** — No changes needed (already handles `metric`/`imperial`)
4. **`src/pages/PrintTags.tsx`** — Normalize `unit` param through `sessionUnitToDisplay()`
5. **`src/components/office/TagsExportView.tsx` handlePrint** — Normalize unit before passing to URL

### Result
- Session unit `"in"` or `"ft"` won't silently break tag/print display
- Data is always mm in DB; display is either "show mm" or "show ft-in"
- No DB migration needed

