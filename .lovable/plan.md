

## Fix: Empty Balance Sheet Report on /accounting Page

### Problem
The Balance Sheet report on the `/accounting` page returns no data when "Run Report" is clicked. The table renders empty.

### Root Cause
In `supabase/functions/quickbooks-oauth/index.ts` (line 1069), the Balance Sheet API call uses:
```
reports/BalanceSheet?date_macro=Custom&end_date=${asOfDate}
```

The `date_macro=Custom` parameter requires **both** `start_date` and `end_date` to be provided. The `start_date` is missing, which causes QuickBooks to return an empty or malformed report response.

For comparison, the Profit and Loss handler correctly passes both `start_date` and `end_date`.

### Solution

**File: `supabase/functions/quickbooks-oauth/index.ts`** (line 1066-1071)
- Remove `date_macro=Custom` and use only `end_date` for the Balance Sheet report, which is QB's standard way to request a point-in-time balance sheet. The correct parameter for a Balance Sheet "as of" date is:
  ```
  reports/BalanceSheet?end_date=${asOfDate}
  ```
  This tells QuickBooks to compute balances as of that date without needing a start date.

### Technical Detail

```typescript
// Before (line 1069):
const data = await qbFetch(config, `reports/BalanceSheet?date_macro=Custom&end_date=${asOfDate}`);

// After:
const data = await qbFetch(config, `reports/BalanceSheet?end_date=${asOfDate}`);
```

Then redeploy the `quickbooks-oauth` edge function.

**Files to edit:** `supabase/functions/quickbooks-oauth/index.ts`

