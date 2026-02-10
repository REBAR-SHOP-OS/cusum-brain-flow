

## Fix Production Queue: No Merged Barlists, No Unknown Customer

### Problem
1. **"Unknown Customer" appearing**: The customer names are fetched in a separate query that can race with the projects query. When the customer lookup hasn't resolved yet, the fallback "Unknown Customer" label is shown.
2. **Potential merging**: If two projects reference the same customer but the customer name can't be resolved, they could appear merged under "Unknown Customer".

### Solution

**File: `src/components/office/ProductionQueueView.tsx`**

**Change 1 — Fetch customer names via project join instead of separate query**

Replace the separate `customers-for-queue` query (lines 141-150) with a single projects query that joins customer data. Update `useProjects` usage or add an inline query that fetches `projects` with `customer:customers(id, name)` joined, so customer names are always available alongside their projects -- no race condition.

Alternatively, keep the current approach but:
- Skip rendering the tree until both `projects` and `customers` data have loaded
- Add a loading guard: if `projectCustomerIds.length > 0` and `customers` is still undefined/loading, show the loading state

**Change 2 — Eliminate "Unknown Customer" fallback**

In `buildCustomerTree` (line 302), instead of falling back to `"Unknown Customer"`, either:
- Skip customers whose name can't be resolved (filter them out entirely until data loads)
- Or fetch the customer name directly from the joined project data

**Change 3 — Ensure barlists stay separated per customer**

The current tree builder groups barlists by project, and projects by customer. This is already correct structurally. The "merging" issue is caused by multiple customers falling into "Unknown Customer" when names aren't resolved. Fixing the name resolution (Changes 1-2) automatically fixes this.

### Technical Details

**Preferred approach** — modify the customers query to be blocking:

1. In `ProductionQueueView`, change the customers query to use `enabled: !!user && projectCustomerIds.length > 0` (already done) and add `isLoading` tracking
2. Show loading state until both projects AND customers are loaded
3. Replace the `"Unknown Customer"` fallback on line 302 with a skip: if `customerMap.get(cid)` is undefined, exclude that customer node from the tree (they'll appear once the data loads)
4. Remove the `"Unassigned"` customer bucket for orphan projects — instead label it clearly as "No Customer Assigned" and only show it if there are genuinely projects with `customer_id = null`

### Scope
- Single file: `src/components/office/ProductionQueueView.tsx`
- No backend, migration, or schema changes needed
