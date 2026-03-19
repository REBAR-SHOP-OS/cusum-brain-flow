

# Wire Unit System Through the Full Pipeline

## Problem

When the user selects "Imperial (ft-in)" in the BarlistMappingPanel, the selection is not saved to the session's `unit_system` column. The line items table checks `activeSession?.unit_system === "imperial"` to decide whether to format values as ft-in, but that field stays as whatever the AI auto-detected (or null). So the bottom table shows raw decimal values (1321, 584.2) instead of formatted ft-in strings (110'-1", 48'-8").

Additionally, `formatDimForDisplay` only supports "½" fractions — missing ⅛, ¼, ⅜, ⅝, ¾, ⅞.

## Changes

### 1. Pass `lengthUnit` from BarlistMappingPanel to parent

**File:** `src/components/office/BarlistMappingPanel.tsx`

- Extend `onConfirmMapping` callback signature to include `unitSystem: string` (the selected `lengthUnit`)
- Call `onConfirmMapping(allMapped, lengthUnit)` on confirm

### 2. Save unit_system to session on mapping confirm

**File:** `src/components/office/AIExtractView.tsx`

- Update `handleMappingConfirmed` to accept `(mappedRows, unitSystem)` 
- When `unitSystem` is "imperial" or "ft" or "in", update the session: `supabase.from("extract_sessions").update({ unit_system: unitSystem === "imperial" ? "imperial" : unitSystem === "ft" ? "imperial" : "metric" }).eq("id", activeSessionId)`
- Also call `refreshSessions()` so `activeSession.unit_system` reflects the change

### 3. Fix `formatDimForDisplay` to support all ⅛ fractions

**File:** `src/components/office/AIExtractView.tsx`

- Replace the simple "½" check with the full fraction map from `unitSystem.ts` (⅛, ¼, ⅜, ½, ⅝, ¾, ⅞)
- Same fix in `src/components/office/TagsExportView.tsx` if it has the same function

### 4. Also apply the same fix in TagsExportView

**File:** `src/components/office/TagsExportView.tsx`

- Update its `formatDim` function to use the same full-fraction logic

## Technical Details

```text
Current flow:
  BarlistMappingPanel (user picks "Imperial ft-in")
    → converts values to mm ✓
    → passes MappedRow[] to parent ✓  
    → unit selection is LOST ✗   ← problem here

Fixed flow:
  BarlistMappingPanel (user picks "Imperial ft-in")
    → converts values to mm ✓
    → passes (MappedRow[], "imperial") to parent ✓
    → parent saves unit_system="imperial" on session ✓
    → line items table reads activeSession.unit_system ✓
    → formatDimForDisplay converts to ft-in with proper fractions ✓
```

**Files to modify:**
- `src/components/office/BarlistMappingPanel.tsx` — pass unit to callback
- `src/components/office/AIExtractView.tsx` — save unit to session + fix fractions
- `src/components/office/TagsExportView.tsx` — fix fractions

