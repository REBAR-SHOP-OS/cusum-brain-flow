

## Fix: Stale Invoice Data Causes False Overdue Alerts

### Problem
The AI Actions Queue shows invoices as overdue and unpaid when they have already been paid in QuickBooks. For example, ZACK DURHAM's Invoice #2219-1 ($236.40) appears as 10 days overdue in Penny's queue, but it's already paid in QuickBooks. The `accounting_mirror` table was last synced on Feb 11 -- over 13 days ago -- so the balance is stale.

### Root Cause
The `penny-auto-actions` edge function reads invoice balances from the `accounting_mirror` table **without triggering a QuickBooks sync first**. If the mirror data is stale (which it is -- many records haven't synced since Feb 13), invoices that have been paid in QuickBooks still show `balance > 0`, causing Penny to generate false collection actions.

### Solution
Force a QuickBooks incremental sync **before** scanning for overdue invoices. This ensures the `accounting_mirror` has up-to-date balance data before Penny makes decisions.

### Changes

**File: `supabase/functions/penny-auto-actions/index.ts`**
- After obtaining the `companyId`, trigger a QB sync by calling the `qb-sync-engine` edge function with `action: "incremental"` and wait for it to complete
- Add a short timeout (15s) so the scan doesn't hang if the sync is slow
- If the sync fails, log a warning but proceed with existing mirror data (graceful degradation)
- This ensures every "Scan Now" click first refreshes QB data, then analyzes invoices

### Technical Detail

Add a sync step before the overdue invoice query (after line 19):

```typescript
// Force QB sync before scanning to ensure fresh balance data
try {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const syncController = new AbortController();
  const syncTimeout = setTimeout(() => syncController.abort(), 15000);
  
  await fetch(`${supabaseUrl}/functions/v1/qb-sync-engine`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${svcKey}`,
    },
    body: JSON.stringify({ action: "incremental", company_id: companyId }),
    signal: syncController.signal,
  });
  clearTimeout(syncTimeout);
  console.log("[penny-auto-actions] QB sync completed before scan");
} catch (syncErr) {
  console.warn("[penny-auto-actions] QB sync failed, proceeding with cached data:", syncErr);
}
```

This is inserted before the `accounting_mirror` query so the mirror table has fresh balances when Penny analyzes invoices. The 15-second timeout prevents the scan from hanging if QuickBooks API is slow.

**Files to edit:** `supabase/functions/penny-auto-actions/index.ts`

