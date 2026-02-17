
# Fix: Quotations Limited to 1,000 Records + Improvements

## Problem
The database contains **2,586 archived quotations** but only **1,000** are displayed. This is caused by the default row limit in database queries. The current hook fetches all records in a single unbounded `SELECT *` call, which silently caps at 1,000.

Additionally, loading 2,586 records into memory at once is unnecessary -- the UI should paginate and allow filtering.

## Status Breakdown (all 2,586 records)
| Status | Count |
|--------|-------|
| Quotation Sent | 1,480 |
| Sales Order | 969 |
| Draft Quotation | 85 |
| Cancelled | 52 |

---

## What Will Be Fixed

### 1. Paginated Data Fetching in `useArchivedQuotations`
- Replace the single unbounded query with a **paginated hook** that accepts `page`, `pageSize`, `search`, and `statusFilter` parameters
- Use `.range(from, to)` to fetch only the current page
- Return `totalCount` using `{ count: "exact", head: false }` so the UI knows total pages
- Default page size: 50

### 2. Add Search, Filters, and Pagination UI to `AccountingDocuments`
- Add a **search bar** (filters by quote number or customer name)
- Add a **status filter dropdown** (All, Draft Quotation, Quotation Sent, Sales Order, Cancelled)
- Add **pagination controls** (Previous / Next with page indicator like "Page 1 of 52")
- Show total count in the tab badge accurately (from count query, not array length)

### 3. Server-Side Filtering
- Search uses `.or()` with `ilike` on `quote_number` and metadata customer name
- Status filter uses `.eq("odoo_status", status)` when not "all"
- Both filters are applied server-side so pagination counts remain accurate

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useArchivedQuotations.ts` | Rewrite to accept pagination/filter params, use `.range()` and `count: "exact"` |
| `src/components/accounting/AccountingDocuments.tsx` | Add search bar, status filter dropdown, pagination controls for quotations tab |

## Technical Details

**Hook signature change:**
```typescript
useArchivedQuotations({ page, pageSize, search, status })
// Returns: { quotations, isLoading, totalCount, totalPages }
```

**Key query fix:**
```typescript
let query = supabase
  .from("quotes")
  .select("*", { count: "exact" })
  .eq("source", "odoo_sync");

if (search) query = query.or(`quote_number.ilike.%${search}%,salesperson.ilike.%${search}%`);
if (status !== "all") query = query.eq("odoo_status", status);

query = query.order("created_at", { ascending: false })
  .range(from, to);
```

This ensures all 2,586 quotations are accessible with fast, paginated loading.
