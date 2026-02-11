

## Fix Chart of Accounts - Ensure Full Account List Loads

### Problem
The Chart of Accounts still only shows 4 Bank accounts despite the code change. The `list-accounts` call in Phase 2 is likely failing silently (one of 11 concurrent API calls). Since `Promise.allSettled` is used, a failure means the bank-only accounts from Phase 1 (`dashboard-summary`) are never replaced.

### Root Cause
Phase 2 fires 11 simultaneous API calls to QuickBooks. The `list-accounts` call may be timing out or getting rate-limited. When it fails, `fullAccountsResult.status` is `"rejected"`, so `setAccounts` never runs with the full list.

### Fix

**File: `src/hooks/useQuickBooksData.ts`**

Move the `list-accounts` call out of the Phase 2 batch and into Phase 1, right after `dashboard-summary`. This ensures it runs early and reliably with minimal concurrency:

```
Phase 1 (sequential):
  1. dashboard-summary -> set invoices, bills, payments (bank accounts used for dashboard only)
  2. list-accounts -> set full accounts list
  3. setLoading(false)
```

This way the full Chart of Accounts loads immediately with the dashboard, not as a background afterthought that can silently fail.

Also add a `console.log` guard so if it does fail, we know why.

### Changes

**`src/hooks/useQuickBooksData.ts`**
- After the `dashboard-summary` call (line 170), add a separate `list-accounts` call before `setLoading(false)`
- Set accounts from the full list immediately, falling back to dashboard bank accounts if it fails
- Remove `list-accounts` and `fullAccountsResult` from the Phase 2 batch (lines 181-204)
