
# Fix QuickBooks Connection Stability

## Problems Identified

1. **Proactive token refresh missing**: The `check-status` handler refreshes tokens only when expired, but the `qbFetch` function in `quickbooks-oauth` only auto-refreshes on 401 errors. There is no proactive refresh before tokens expire, leading to a window where requests fail before the 401 retry kicks in.

2. **Race condition on concurrent refreshes in `quickbooks-oauth`**: The `_refreshPromise` variable is module-level but edge functions can spin up multiple isolates. Within a single isolate, if `loadAll` fires multiple `qbAction` calls in parallel (e.g., `list-employees`, `list-time-activities`, `get-company-info` all at once), each call enters `qbFetch` independently. If the token expires mid-batch, multiple 401 retries can trigger competing refresh attempts despite the deduplication guard.

3. **`loadAll` fires too many parallel QB API calls**: The fallback path fires 10 parallel `qbAction` calls (vendors, estimates, company info, items, POs, credit memos, employees, time activities, sync-customers, sync-invoices). QB's rate limit is strict, causing 429 errors and cascading retries that make the connection appear unstable.

4. **No retry/backoff on the client side**: If `qbAction` fails, the error is thrown up with no retry. A transient 429 or network blip at the edge function level surfaces as a hard failure to the user.

5. **`checkConnection` triggers a token refresh but `loadAll` immediately follows with API calls**: If the token was just refreshed in `check-status`, the updated token is stored in the DB, but the next `qbAction` call gets a fresh `getQBConfig` read, which should be fine -- unless the DB write hasn't propagated yet (rare but possible with async updates).

## Solution

### 1. Proactive token refresh in `qbFetch` (edge function)
Add a check at the start of `qbFetch` in `quickbooks-oauth/index.ts`: if `config.expires_at` is within 5 minutes of now, proactively refresh before making the API call. This eliminates the "expired token -> 401 -> retry" cycle.

### 2. Throttle parallel QB API calls in `loadAll` (client hook)
Change the fallback path in `useQuickBooksData.ts` to batch the 10 parallel calls into sequential groups of 3-4, reducing the chance of hitting QB rate limits. Also add a simple retry wrapper with exponential backoff around `qbAction`.

### 3. Add client-side retry wrapper
Create a `retryQBAction` helper that wraps `qbAction` with up to 2 retries and exponential backoff (1s, 3s) for transient failures.

### 4. Improve error status handling in `check-status`
When the token refresh fails in `check-status`, currently it sets `status: "error"` on the connection row. But the next `loadAll` call sees `connected === false` and shows "Connect QuickBooks" even though the issue is a transient refresh failure. Instead, preserve `status: "connected"` and return a retryable error so the client can retry rather than showing the disconnect screen.

---

## Technical Details

### File: `supabase/functions/quickbooks-oauth/index.ts`

**Proactive token refresh in qbFetch** (around line 141-200):
- Before making the API request, check if `config.expires_at < Date.now() + 300_000` (5 min buffer)
- If so, trigger the shared `refreshQBToken` flow proactively
- This prevents 401 errors from ever occurring during normal operation

**Improve check-status error handling** (around line 579-587):
- On refresh failure, don't set the connection to `status: "error"` immediately
- Instead, check if the `refresh_token_expires_at` (stored during callback) has truly passed
- Only mark as "error" if the refresh token itself is expired (100 days for QB)
- For transient failures, return `{ status: "retry", error: "temporary" }` so the client retries

### File: `src/hooks/useQuickBooksData.ts`

**Add retry wrapper** (new helper near top of file):
- `retryQBAction(qbAction, action, body, maxRetries=2)` -- wraps calls with exponential backoff
- Catches errors and retries after 1s then 3s delays

**Throttle parallel calls in loadAll fallback** (around line 322-346):
- Split the 10 parallel calls into 3 sequential batches:
  - Batch 1: vendors, estimates, company-info, items
  - Batch 2: POs, credit-memos, employees, time-activities
  - Batch 3: sync-customers, sync-invoices
- Each batch uses `Promise.allSettled` but batches run sequentially

**Background calls after mirror load** (around line 299-303):
- Wrap the background calls (employees, time-activities, company-info) with the retry wrapper
- Add a small stagger (500ms) between them to avoid rate limiting

### File: `supabase/functions/qb-sync-engine/index.ts`

**Same proactive refresh** (around line 61-98):
- Add the same 5-minute expiry buffer check before `qbFetch` calls
- This ensures the sync engine also doesn't run into expired tokens mid-sync
