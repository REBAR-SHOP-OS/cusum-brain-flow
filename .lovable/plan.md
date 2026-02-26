

## Plan: Fix Customer Deletion Error in Production Queue

### Problem
Clicking "Delete" on a customer folder in the Production Queue tries to delete the actual `customers` record from the database. A database trigger (`block_customer_delete_with_orders`) blocks this because the customer has 2 active orders. The Production Queue should only remove production-related items (plans, barlists, projects), not the customer record itself.

### File: `src/components/office/ProductionQueueView.tsx`

**Change `handleDeleteCustomer` (lines 108-128):**
- Keep the logic that deletes child projects, barlists, and plans (already handled by `handleDeleteProject`)
- **Remove** the lines that delete contacts and the customer record (lines 114-121)
- After cleaning up production items, just invalidate queries and show success toast
- This way, the customer record stays intact (with its orders/quotes), but the production queue items are removed

### Summary of edit
- Lines 114-121: Remove `supabase.from("contacts").delete()` and `supabase.from("customers").delete()` calls
- The customer folder disappears from the queue naturally because its projects/plans are gone

