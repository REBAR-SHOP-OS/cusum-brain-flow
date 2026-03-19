

# Fix: Preserve Original Imperial Measurements in Extraction

## Problem
The source bar list uses imperial measurements (e.g., Length: 5'-8", A: 0'-4", B: 1'-5"). After extraction, the `parseDimension()` function converts these to total inches (68, 4, 17) and the UI incorrectly labels them "MM". The user wants to see the exact same measurements as the source document.

## Root Cause
1. `parseDimension()` in `extract-manifest/index.ts` converts "0'-4"" → 4 inches, "1'-5"" → 17 inches
2. The AI prompt correctly says "keep values exactly as they appear" but `parseDimension()` overrides this by converting
3. The UI displays raw numbers with "MM" label regardless of the actual unit system

## Solution
Store values in inches (current behavior is fine for storage), but add unit detection and proper imperial display formatting.

### 1. Edge Function: `extract-manifest/index.ts`
- After AI extraction, detect if values are imperial by checking the AI response for feet-inches patterns (e.g., "X'-Y"")
- Store a `unit_system` field on the `extract_sessions` table: `"imperial"` or `"metric"`
- Keep `parseDimension()` as-is (converting to total inches is fine for calculations)

### 2. Database Migration
- Add `unit_system TEXT DEFAULT 'metric'` column to `extract_sessions` table

### 3. UI: `TagsExportView.tsx`
- Add a helper function `formatDimension(inches: number): string` that converts inches back to feet-inches format (e.g., 17 → `1'-5"`, 68 → `5'-8"`)
- When `unit_system` is `"imperial"`, display dimensions and length in feet-inches format instead of raw numbers with "MM"
- When `unit_system` is `"metric"`, keep current "MM" display

### 4. Fetch unit_system
- Update the extract session query in the parent component or TagsExportView to include `unit_system`
- Pass it to the dimension display logic

### Display Format Examples
| Stored Value (