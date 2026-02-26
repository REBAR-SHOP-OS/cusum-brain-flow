

# Clear Stale AI Queue and Rescan

## Problem
The `penny_collection_queue` table has 35 stale items with outdated data. The existing tools don't expose a direct write path to delete rows from the client side.

## Solution

**Step 1: Add a `purge` option to `penny-auto-actions` edge function**

Modify `supabase/functions/penny-auto-actions/index.ts` to accept an optional `{ purge: true }` flag in the request body. When set, it deletes all existing queue items before scanning.

| File | Change |
|---|---|
| `supabase/functions/penny-auto-actions/index.ts` | After auth (line 19), parse request body for `purge` flag. If true, `DELETE FROM penny_collection_queue WHERE company_id = companyId` before proceeding with the scan. |

**Step 2: Add a "Clear & Rescan" button to the UI**

Update `usePennyQueue.ts` `triggerAutoActions` to accept an optional `purge` parameter, passed to the edge function body.

Update `AccountingActionQueue.tsx` to add a "Clear & Rescan" option (or modify the existing "Scan Now" button to include a clear option).

| File | Change |
|---|---|
| `src/hooks/usePennyQueue.ts` | Update `triggerAutoActions` to accept `{ purge?: boolean }` and pass it in the function invoke body |
| `src/components/accounting/AccountingActionQueue.tsx` | Add a "Clear & Rescan" button that calls `triggerAutoActions` with `purge: true` |

**Step 3: Invoke immediately to clear stale data**

After deploying, call the edge function with `{ purge: true }` to clear all 35 stale items and regenerate fresh ones from current QuickBooks data.

## Deduplication
The existing function already deduplicates by `invoice_id` and `customer_name` (lines 108-118), so no duplicates will be created during the rescan.

## Technical Details

The edge function change adds ~5 lines after line 19:

```typescript
const body = await req.json().catch(() => ({}));
const purge = body?.purge === true;

if (purge) {
  await supabase.from("penny_collection_queue").delete().eq("company_id", companyId);
  console.log("[penny-auto-actions] Purged all queue items for company", companyId);
}
```

