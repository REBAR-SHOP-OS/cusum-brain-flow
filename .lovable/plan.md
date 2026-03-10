

# Fix: Pipeline Stuck After Dedupe — No Rows / Mapping Panel Missing

## Problem
When dedupe completes with "No Duplicates", the mapping panel doesn't render if `activeRows` is empty (rows failed to load or weren't saved). The "Apply Mapping" button stays disabled, trapping the user at the Dedupe step with no way forward.

## Root Cause
The `BarlistMappingPanel` gate requires `activeRows.length > 0`. If rows aren't loaded yet or the query silently failed, the panel never mounts, `mappingConfirmed` stays `false`, and the button stays disabled.

## Changes

**File: `src/components/office/AIExtractView.tsx`**

1. **Add a loading/empty-state fallback** when `dedupeResolved` is true but `activeRows.length === 0`:
   - Show a warning card: "No extract rows found for this session. Rows may not have been saved during extraction."
   - Add a "Retry Loading Rows" button that calls `refreshRows()`.
   - Add a "Skip to Mapping" fallback button that force-advances the session status to `"mapping"` so the user isn't permanently stuck.

2. **Add a loading indicator** while rows are being fetched — show a spinner instead of nothing when the rows hook `loading` is `true`.

3. **Surface the `rows` loading state** — currently `useExtractRows` returns `{ rows, loading, refresh }` but `loading` isn't used in `AIExtractView`. Destructure and use it.

**File: `src/hooks/useExtractSessions.ts`** — No changes needed.

**File: `src/lib/extractService.ts`** — No changes needed.

## Exact UI Change
- When dedupe is resolved and rows are loading: show a spinner with "Loading extracted rows..."
- When dedupe is resolved and rows are empty after loading: show a warning card with "Retry" and "Skip to Mapping" options
- When rows exist: existing mapping panel renders as before

## Summary
- 1 file changed: `AIExtractView.tsx`
- Loading state surfaced for row fetching
- Empty-rows fallback prevents permanent pipeline lock

