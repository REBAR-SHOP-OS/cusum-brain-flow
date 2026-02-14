
# Proactive QuickBooks Token Warm-Up on Page Open

## What Changes

When you open the Accounting page, QuickBooks data will load faster because:

1. **Mirror data loads instantly** -- while that happens, a background call warms up the QB token so it's ready for any follow-up API calls (employees, time activities, etc.)
2. **`checkConnection` and mirror load run in parallel** instead of sequentially -- the connection check no longer blocks data loading
3. **Token pre-warm on hook mount** -- a lightweight `check-status` call fires as soon as the hook initializes, ensuring the token is refreshed before any data requests need it

Currently: `checkConnection` (waits) -> `loadFromMirror` (waits) -> background API calls (may hit expired token)

After: `checkConnection` + `loadFromMirror` fire together -> mirror data appears instantly -> background API calls use the already-warmed token

## Technical Details

### File: `src/hooks/useQuickBooksData.ts`

**1. Add eager token warm-up on mount**
- Add a new `warmUpToken` function that calls `qbAction("check-status")` silently (no state changes, just ensures the edge function refreshes the token if needed)
- Fire it inside the hook initialization so it runs as soon as the component mounts, before `loadAll` is even called

**2. Parallelize `checkConnection` and `loadFromMirror` in `loadAll`**
- Currently `loadAll` calls `checkConnection()` first, waits for it, then calls `loadFromMirror()`
- Change to run both in parallel with `Promise.all`:
  - Mirror data loads from the local database (no QB token needed)
  - `checkConnection` ensures the token is fresh in the background
  - If `checkConnection` returns false, clear the mirror data and show the connect screen
  - If mirror loaded successfully, set `loading = false` immediately

**3. Pre-fetch connection status on hook init**
- Add a `useEffect` inside `useQuickBooksData` that fires once on mount
- Calls `qbAction("check-status")` to trigger proactive token refresh on the edge function
- Sets `connected` state early so the UI doesn't flash a "not connected" state
- This runs independently of `loadAll`, so even before the page triggers data loading, the token is already being warmed

### File: `supabase/functions/quickbooks-oauth/index.ts`

**No changes needed** -- the proactive refresh logic (5-minute buffer) is already implemented in `qbFetch`. The `check-status` handler already refreshes expired tokens. The warm-up call from the client will trigger this existing logic.

### Result
- Mirror data appears instantly on page open (no waiting for token check)
- QB API calls (employees, time activities) never hit an expired token because the warm-up already refreshed it
- No extra network calls -- we just reorder the existing ones to run in parallel
