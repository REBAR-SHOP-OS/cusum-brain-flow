

## Fix: Stale QuickBooks Data on Accounting Page

### Problem
When the accounting page loads, `loadAll()` reads from local mirror tables (`qb_transactions`, `qb_customers`, etc.). If mirror data exists, it returns immediately **without syncing from QuickBooks**. The mirror data was last synced on Feb 13 -- 11 days ago -- so all displayed data (invoices, customer details, balances) is stale.

Additionally, the Penny AI Action Queue stores `days_overdue` as a static value at creation time, so it drifts further from reality each day.

### Root Cause
In `useQuickBooksData.ts`, the `loadAll` function (line 354-474):
1. Calls `loadFromMirror()` which reads cached data from DB tables
2. If mirror has data, it returns `true` and `loadAll` exits early (line 369-389)
3. No background incremental sync is triggered to refresh the mirror

### Solution

#### 1. Trigger background incremental sync after loading from mirror
**File:** `src/hooks/useQuickBooksData.ts`

After `loadFromMirror()` succeeds and fast-loads cached data for the UI, trigger an incremental sync **in the background** to refresh the mirror. Once the sync completes, re-read from mirror to update the UI with fresh data.

```text
if (mirrorLoaded) {
  setLoading(false);
  // Background: trigger incremental sync to refresh mirror data
  (async () => {
    try {
      await qbAction("incremental-sync");
      // Re-load from mirror after sync completes
      await loadFromMirror();
    } catch (e) {
      console.warn("[QB] Background incremental sync failed:", e);
    }
  })();
  // ... existing employee/time-activity loading
  return;
}
```

This gives users instant cached data while silently refreshing in the background.

#### 2. Recalculate days_overdue dynamically in the Penny Queue
**File:** `src/hooks/usePennyQueue.ts`

After loading queue items, recalculate `days_overdue` based on `created_at` + original `days_overdue` so the displayed value stays current:

```text
// After fetching items, recalculate days_overdue dynamically
const now = new Date();
const recalculated = (data || []).map(item => {
  const createdAt = new Date(item.created_at);
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
  return {
    ...item,
    days_overdue: item.days_overdue + daysSinceCreation,
  };
});
```

#### 3. Auto-clean resolved queue items after sync
**File:** `supabase/functions/penny-auto-actions/index.ts`

Before creating new queue items, check if any existing pending items reference invoices that have been paid (balance = 0 in `accounting_mirror`) and auto-reject them with a note:

```text
// Clean up stale items where invoice balance is now 0
const { data: staleItems } = await supabase
  .from("penny_collection_queue")
  .select("id, invoice_id")
  .eq("company_id", companyId)
  .eq("status", "pending_approval");

for (const item of staleItems || []) {
  const { data: mirror } = await supabase
    .from("accounting_mirror")
    .select("balance")
    .eq("quickbooks_id", item.invoice_id)
    .maybeSingle();
  if (mirror && mirror.balance <= 0) {
    await supabase
      .from("penny_collection_queue")
      .update({ status: "rejected", execution_result: { reject_reason: "Invoice paid - auto-resolved" } })
      .eq("id", item.id);
  }
}
```

### Summary

| Change | File | Purpose |
|--------|------|---------|
| Background incremental sync | `src/hooks/useQuickBooksData.ts` | Refresh mirror data silently after showing cached data |
| Dynamic days_overdue | `src/hooks/usePennyQueue.ts` | Keep overdue day counts accurate |
| Auto-resolve paid items | `supabase/functions/penny-auto-actions/index.ts` | Remove queue items for paid invoices |

