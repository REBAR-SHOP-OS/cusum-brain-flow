

## Fix: Customer List Capped at 1000 on Accounting Page

### Problem
The accounting page shows "Customers (1000)" instead of the full ~1,947 customers. The database has 1,947 active `qb_customers` records, but the query fetching them is silently truncated at 1,000 rows by the backend's default row limit.

### Root Cause
In `src/hooks/useQuickBooksData.ts` (line 296), the `loadFromMirror` function fetches customers with:
```typescript
supabase.from("qb_customers").select("*").eq("is_deleted", false).limit(5000)
```
Despite requesting 5,000 rows, the backend enforces a maximum of 1,000 rows per query. The same issue affects vendors, accounts, and items queries on lines 295-298.

The `loadMirrorTransactions` helper (line 149) already implements proper pagination using `.range()` -- but the entity-table queries (customers, vendors, accounts, items) do not.

### Solution

**File: `src/hooks/useQuickBooksData.ts`**

1. Create a generic paginated fetch helper (similar to `loadMirrorTransactions`) for mirror entity tables:

```text
async function loadMirrorEntity(table, selectCols, filterCol, filterVal) {
  const all = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await supabase
      .from(table)
      .select(selectCols)
      .eq(filterCol, filterVal)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}
```

2. Replace the four `.limit(5000)` calls on lines 295-298 with calls to this paginated helper:

| Line | Current | Change |
|------|---------|--------|
| 295 | `supabase.from("qb_accounts").select("*").eq("is_deleted", false).limit(5000)` | `loadMirrorEntity("qb_accounts", "*", "is_deleted", false)` |
| 296 | `supabase.from("qb_customers").select("*").eq("is_deleted", false).limit(5000)` | `loadMirrorEntity("qb_customers", "*", "is_deleted", false)` |
| 297 | `supabase.from("qb_vendors").select("*").eq("is_deleted", false).limit(5000)` | `loadMirrorEntity("qb_vendors", "*", "is_deleted", false)` |
| 298 | `supabase.from("qb_items").select("*").eq("is_deleted", false).limit(5000)` | `loadMirrorEntity("qb_items", "*", "is_deleted", false)` |

3. Update the data consumers on lines 308-324 to handle the new return type (raw arrays instead of `{ data }` objects) -- e.g., `mirrorCustomersData` becomes an array directly instead of `mirrorCustomersData.data`.

### What This Does NOT Touch
- No database schema changes needed
- No edge function changes
- The QB API fallback path (lines 403+) already has proper pagination for customers (lines 451-465)
- No UI component changes required -- the count display is already dynamic

