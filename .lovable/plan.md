

# Fix: Timezone Consistency Across Vizzy (Client + Server)

## Problem
Vizzy reports inconsistent times because multiple files call `toLocaleString()` / `toLocaleTimeString()` / `toLocaleDateString()` **without passing a timezone**, so they default to UTC (on Deno edge functions) or browser-local (on client). This causes "each time Vizzy says different time."

## Root Cause Files

### 1. `src/lib/vizzyContext.ts` (client-side context builder)
Three places use `Date` formatting without timezone:
- **Line 120**: `new Date().toLocaleString()` — snapshot header shows wrong time
- **Line 170**: `fmtTime` for team presence — no `timeZone` option
- **Line 193**: email dates — no `timeZone` option

**Fix**: Accept `timezone` parameter (from `useWorkspaceSettings`) and pass `{ timeZone: tz }` to all three formatting calls.

### 2. `supabase/functions/vizzy-context/index.ts` (snapshot endpoint)
- **Line ~50**: `todayStart` computation mirrors the server pattern but the returned snapshot data doesn't include the workspace timezone for the client to use in formatting.

**Fix**: Include `timezone` in the returned snapshot so the client `buildVizzyContext` can use it.

### 3. `supabase/functions/daily-summary/index.ts`
- **Lines 231-233**: Uses `new Date().toISOString().split("T")[0]` for "today" (UTC-based) and hardcoded `T00:00:00.000Z` / `T23:59:59.999Z` boundaries — ignores workspace timezone entirely.

**Fix**: Import `getWorkspaceTimezone`, compute `today` and `todayStart`/`todayEnd` using timezone-aware boundaries (same pattern as `vizzyFullContext.ts`).

### 4. `src/types/vizzy.ts`
**Fix**: Add optional `timezone?: string` field to `VizzyBusinessSnapshot`.

## Changes Summary

| File | Change |
|------|--------|
| `src/lib/vizzyContext.ts` | Add `timezone` param; pass `{ timeZone }` to all 3 formatting calls |
| `src/types/vizzy.ts` | Add `timezone?: string` to snapshot type |
| `supabase/functions/vizzy-context/index.ts` | Include `timezone: tz` in returned snapshot |
| `supabase/functions/daily-summary/index.ts` | Use `getWorkspaceTimezone` for date boundaries |

## Callers of `buildVizzyContext`
The function is called from hooks that already have access to `useWorkspaceSettings`. The timezone will be passed through from the snapshot itself (self-contained).

No database changes needed.

