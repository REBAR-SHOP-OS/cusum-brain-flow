

# Fix: Extract Rows Stuck on "Loading" — Robustness Improvements

## Diagnosis

The RLS fix from the previous migration is **working correctly** — the `user_can_access_session` function returns `true`, the query executes in 2.5ms, and 61 rows exist. The "Loading extracted rows..." state you're seeing is from a **stale browser session** that cached the empty result before the RLS fix was deployed.

However, there are real robustness gaps that can cause the loading state to appear stuck:

## Obstacles Found

### 1. No loading timeout or auto-retry
The `useExtractRows` hook fetches once and never retries. If the fetch returns 0 rows (e.g., due to stale RLS), the user sees "Loading..." forever since `rowsLoading` stays `true` during the fetch with no fallback.

### 2. No realtime subscription for `extract_rows`
The `useExtractSessions` hook subscribes to realtime changes, but `useExtractRows` does NOT. When the edge function inserts rows during extraction, the UI has no way to know rows appeared — the user must manually refresh.

### 3. Loading condition too strict at step 3
The condition `rowsLoading || !rowsHasFetched` blocks the entire mapping panel. If the fetch completes with 0 rows (transient RLS issue), the user sees "No extracted rows" with only a manual retry button.

## Plan

### File: `src/hooks/useExtractSessions.ts` — `useExtractRows` hook

1. **Add realtime subscription** for `extract_rows` filtered by `session_id`, triggering `refresh()` on INSERT/UPDATE/DELETE events — identical pattern to `useExtractSessions`.

2. **Add auto-retry with backoff** — if the first fetch returns 0 rows and the session status suggests rows should exist, retry once after 2 seconds.

### File: `src/components/office/AIExtractView.tsx`

3. **Add a loading timeout** — if `rowsLoading` is true for more than 10 seconds, show a retry button alongside the spinner instead of an infinite loading state.

### No database changes needed
The RLS fix is already deployed and working.

