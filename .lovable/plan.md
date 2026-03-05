

# Fix: Missing Invoice # and Date on Packing Slip

## Root Cause

The invoice resolution chain (`cut_plan_items → work_orders → barlists → extract_sessions`) fails silently when any link in the chain is null — e.g., no `work_order_id` on `cut_plan_items` at the time of slip creation. The fallback to `orders` only triggers if `work_order_id` exists but the extract_sessions path fails — it doesn't cover the case where `cut_plan_items` has no `work_order_id` at all.

Database confirms: for the customer in the screenshot (ORIN, Hamza Momade), the recreated slip PS-1772735855061 now has invoice data (2259, 2026-03-04), but the original slip shown in the screenshot (PS-1772730835747) was created before work_order_ids were populated.

## Fix — Two Changes

### 1. `src/pages/LoadingStation.tsx` — Add direct order fallback at creation time
After the existing resolution chain (lines 153-216), add a final fallback that queries orders directly via the cut_plan's project:

```typescript
// Final fallback: orders via cut_plan → project
if (!invoiceNumber || !invoiceDate) {
  const { data: orderRow } = await supabase
    .from("orders")
    .select("order_number, order_date")
    .eq("project_id", /* project id from planData */)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderRow) {
    if (!invoiceNumber) invoiceNumber = orderRow.order_number;
    if (!invoiceDate) invoiceDate = orderRow.order_date 
      ? new Date(orderRow.order_date).toISOString().slice(0, 10) : null;
  }
}
```

This requires extracting the project_id from the planData query (already fetched at line 124).

### 2. `src/pages/DeliveryTerminal.tsx` — Same fallback for backfill
Add the same project-based order fallback after line 141, so that when the delivery terminal is opened for older slips that were created without invoice data, the backfill can still resolve it.

This requires fetching the cut_plan's project_id from the slip's `cut_plan_id`.

### Summary
- Single-line addition to the existing `select` at line 124-128 of LoadingStation to include project id
- ~15 lines of fallback code in each of the two files
- No database changes needed
- No UI changes needed — the display code already handles these fields

