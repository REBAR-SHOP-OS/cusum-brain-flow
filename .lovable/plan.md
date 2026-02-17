
# Fix: Accounting Customer Delete/Edit Not Persisting After Refresh

## Root Cause

The Accounting Customers tab displays data from the `qb_customers` mirror table (via `useQuickBooksData` hook), but delete/edit operations target the `customers` table. These are **two different tables**:

- `qb_customers` -- QuickBooks mirror, source of the list
- `customers` -- local CRM table, where delete actually runs

After delete, the row vanishes from the UI because React state updates, but on refresh `qb_customers` reloads the same row since it was never touched. Same issue with edits -- changes go to `customers` but the displayed data comes from `qb_customers`.

Additionally, `useQuickBooksData` uses plain `useState` (not react-query), so `queryClient.invalidateQueries` for `["qb_customers"]` does nothing.

## Fix (Single File: `AccountingCustomers.tsx`)

### 1. On Delete -- also soft-delete from `qb_customers`
When deleting a customer, look up its `quickbooks_id`, then set `is_deleted = true` on the matching `qb_customers` row. Also remove the entry from the in-memory `data.customers` array so the UI updates instantly without needing a full reload.

### 2. On Edit -- update `qb_customers` display fields too
After the `CustomerFormModal` saves to `customers`, also update the corresponding `qb_customers` row's `display_name` and `company_name` to keep the mirror in sync.

### 3. Add optimistic removal from local state
After a successful delete, filter out the deleted customer from the parent's `data.customers` array. Since `useQuickBooksData` exposes setters or the array is mutable, we will call a callback or filter locally.

### 4. Guards and throttle
- Guard: skip `qb_customers` update if no `quickbooks_id` exists on the local customer
- Throttle: disable delete button while mutation is in-flight (already handled by `deleteMutation.isPending`)
- Safe serialization: no raw JSON in payloads, only typed fields

## Technical Steps

**In `AccountingCustomers.tsx`:**

1. Add a `deletedQbIds` local state (`Set<string>`) to track deleted QB IDs for instant UI filtering
2. Update `deleteMutation` to also run `supabase.from("qb_customers").update({ is_deleted: true }).eq("qb_id", quickbooks_id)` when a `quickbooks_id` exists
3. On success, add the QB ID to `deletedQbIds` so the row disappears immediately
4. Filter `enriched` list to exclude IDs in `deletedQbIds`
5. After edit success in `CustomerFormModal` (already invalidates `["local_customer_by_qb"]`), also update `qb_customers` display fields via an `onSaved` callback

No new files, no new dependencies, no schema changes.
