

## Plan: Eliminate Manual Retry for Row Loading

### Problem
After extraction completes, the UI shows "Loading extracted rows..." indefinitely and requires clicking "Retry" (which only appears after 10s). The rows exist in the database but the initial fetch either fails silently or the loading state gets stuck.

### Root Cause
1. `useExtractRows` hook sets `loading = true` when `sessionId` exists, fetches once, then relies on a single 2s auto-retry if 0 rows returned — but doesn't handle fetch failures or slow responses well
2. The `LoadingRowsCard` waits 10 seconds before showing the Retry button — too long
3. No automatic polling fallback if the initial fetch + realtime subscription both miss the data

### Changes

**1. `src/hooks/useExtractSessions.ts` — Add aggressive auto-retry with polling**

Replace the single 2s retry with a short polling loop (3 attempts, 2s apart) when rows come back empty. This handles the race condition where extraction finishes but rows aren't yet visible due to RLS propagation delay:

```typescript
// Poll up to 3 times at 2s intervals if 0 rows returned
if (data.length === 0 && !retryRef.current) {
  let attempts = 0;
  const poll = async () => {
    if (attempts >= 3) { retryRef.current = null; return; }
    attempts++;
    try {
      const retryData = await fetchExtractRows(sessionId);
      if (retryData.length > 0) {
        setRows(retryData);
        retryRef.current = null;
        return;
      }
    } catch (_) {}
    retryRef.current = setTimeout(poll, 2000);
  };
  retryRef.current = setTimeout(poll, 2000);
}
```

**2. `src/components/office/AIExtractView.tsx` — Reduce Retry button delay from 10s to 4s**

Change line 66 from `setTimeout(() => setShowRetry(true), 10000)` to `setTimeout(() => setShowRetry(true), 4000)`. Users shouldn't wait 10 seconds to get a manual fallback.

**3. `src/components/office/AIExtractView.tsx` — Auto-trigger refresh when entering mapping step**

Add a `useEffect` that calls `refreshRows()` when `currentStepIndex` transitions to 3 (mapping step), ensuring rows are fetched fresh when the session advances to this step. This catches cases where the realtime subscription missed the insert.

### What stays the same
- Realtime subscription logic — unchanged
- Row display and filtering — unchanged
- All downstream consumers — unchanged

### Impact
- Rows should load automatically within 2-6 seconds after extraction
- Retry button appears at 4s instead of 10s as a fallback
- No more stuck "Loading extracted rows..." requiring manual intervention

