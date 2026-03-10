

# Fix: Infinite Fetch Loop After Apply Mapping

## Problem

The `useExtractRows` hook subscribes to realtime changes on `extract_rows`. When "Apply Mapping" updates all 89 rows simultaneously, each row update triggers a separate realtime event → `refresh()` call. This creates ~89 back-to-back fetches, causing the UI to show "Loading extracted rows…" in a rapid loop.

## Fix

**Debounce the realtime callback** in `useExtractRows` so that multiple rapid-fire realtime events within a short window (e.g. 500ms) are collapsed into a single `refresh()` call.

### Changes

**`src/hooks/useExtractSessions.ts`** — `useExtractRows` function:

1. Add a `debounceRef` (setTimeout ref)
2. In the realtime `on` callback, clear any pending debounce and set a new 500ms timeout before calling `refresh()`
3. Clean up the debounce timer on unmount
4. Apply the same pattern to `useExtractSessions` for consistency

This is a ~10-line change in one file.

