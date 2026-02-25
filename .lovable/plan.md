

## Problem: Stale Suggestions Never Get Auto-Resolved

### Root Cause (two layers)

1. **No cleanup logic**: The `generate-suggestions` function creates suggestions but never checks whether the underlying issue has been resolved. There is no step that says "if this invoice now has balance=0, close the suggestion." Old suggestions persist forever with status `open`.

2. **Stale mirror data**: The `accounting_mirror` table was last synced on **Feb 13** (12 days ago). Even if invoices were paid in QuickBooks, the mirror still shows the old balance. The suggestion generator reads from the mirror, so it sees stale overdue amounts.

Currently there are **25 open invoice suggestions**, and the Marsh Brothers one ($146.90, invoice 1499 ODOO) still shows balance > 0 in `accounting_mirror` because the sync hasn't run recently.

### Fix: Add Auto-Resolution Step to `generate-suggestions`

**File: `supabase/functions/generate-suggestions/index.ts`**

Add a cleanup block at the beginning (after loading existing suggestions, before creating new ones) that:

1. Loads all open/new suggestions with `entity_type = 'invoice'`
2. Cross-checks each against `accounting_mirror` — if `balance <= 0` or the invoice no longer exists, auto-resolve the suggestion (set `status = 'resolved'`, `resolved_at = now`)
3. Also auto-resolve the matching `human_tasks` row
4. Does the same for other entity types (orders with `entity_type = 'order'` where status changed to completed/cancelled)

Additionally, auto-resolve suggestions where the `days_overdue` in the title no longer matches reality (invoice paid, balance zeroed).

**Proposed code block** (inserted after line 70, before the `isDuplicate` helper):

```typescript
// ========== AUTO-RESOLVE stale suggestions ==========
// Close invoice suggestions where balance is now 0 or invoice deleted
const { data: openInvoiceSuggestions } = await supabase
  .from("suggestions")
  .select("id, entity_id")
  .in("status", ["open", "new"])
  .eq("entity_type", "invoice");

if (openInvoiceSuggestions && openInvoiceSuggestions.length > 0) {
  const entityIds = openInvoiceSuggestions.map((s: any) => s.entity_id).filter(Boolean);
  const { data: currentInvoices } = await supabase
    .from("accounting_mirror")
    .select("id, balance")
    .in("id", entityIds);

  const balanceMap = new Map((currentInvoices || []).map((i: any) => [i.id, i.balance]));
  const toResolve: string[] = [];

  for (const s of openInvoiceSuggestions) {
    const balance = balanceMap.get(s.entity_id);
    // Resolve if invoice deleted from mirror OR balance is now 0
    if (balance === undefined || balance === null || balance <= 0) {
      toResolve.push(s.id);
    }
  }

  if (toResolve.length > 0) {
    await supabase
      .from("suggestions")
      .update({ status: "resolved", resolved_at: now.toISOString() })
      .in("id", toResolve);
    // Also resolve matching human_tasks
    await supabase
      .from("human_tasks")
      .update({ status: "resolved", resolved_at: now.toISOString() })
      .eq("entity_type", "invoice")
      .in("entity_id", toResolve.map((id: string) => {
        const match = openInvoiceSuggestions.find((s: any) => s.id === id);
        return match?.entity_id;
      }).filter(Boolean))
      .in("status", ["open", "snoozed"]);
    console.log(`Auto-resolved ${toResolve.length} stale invoice suggestions`);
  }
}

// Close order suggestions where order is now completed/cancelled/delivered
const { data: openOrderSuggestions } = await supabase
  .from("suggestions")
  .select("id, entity_id")
  .in("status", ["open", "new"])
  .eq("entity_type", "order");

if (openOrderSuggestions && openOrderSuggestions.length > 0) {
  const orderIds = openOrderSuggestions.map((s: any) => s.entity_id).filter(Boolean);
  const { data: currentOrders } = await supabase
    .from("orders")
    .select("id, status")
    .in("id", orderIds);

  const statusMap = new Map((currentOrders || []).map((o: any) => [o.id, o.status]));
  const toResolve: string[] = [];

  for (const s of openOrderSuggestions) {
    const status = statusMap.get(s.entity_id);
    if (status === undefined || ["completed", "cancelled", "delivered"].includes(status)) {
      toResolve.push(s.id);
    }
  }

  if (toResolve.length > 0) {
    await supabase
      .from("suggestions")
      .update({ status: "resolved", resolved_at: now.toISOString() })
      .in("id", toResolve);
    console.log(`Auto-resolved ${toResolve.length} stale order suggestions`);
  }
}
```

### Immediate Data Cleanup

In addition to the code fix, run a one-time cleanup to resolve all currently stale suggestions where the mirror shows balance = 0 or invoice no longer exists.

### Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/generate-suggestions/index.ts` | Add auto-resolution block that closes suggestions when underlying invoice is paid (balance ≤ 0) or order is completed/cancelled |

This ensures every time `generate-suggestions` runs, it first cleans up resolved issues before creating new ones. Suggestions will no longer persist after the problem is fixed in QuickBooks.

