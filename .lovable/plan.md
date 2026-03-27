

# Fix: Customer Dropdown Not Showing All Customers

## Root Cause
The query to `v_customers_clean` has **no `.limit()` override**, so Supabase applies the default limit of **1000 rows**. There are **2,657 customers** in the view. Since the query orders alphabetically by `display_name`, customers starting with letters past roughly "K" (including "test") are cut off and never loaded.

## Fix

### `src/components/accounting/documents/DraftQuotationEditor.tsx`

**Option A (recommended):** Change the customer loading to a **search-on-type** pattern instead of loading all customers upfront:
- Remove the bulk customer fetch from the initial `loadAll`
- Instead, query `v_customers_clean` dynamically when the user types in the search box (debounced ~300ms)
- Use `.ilike("display_name", `%${search}%`)` with `.limit(50)` for fast results
- This handles any number of customers efficiently

**Option B (quick fix):** Add `.limit(5000)` to the existing query to fetch all 2,657 records. Simpler but less scalable.

### Additional cleanup
- The "Add New Customer" form already works — after creation the customer is added to the local state and selected immediately. The issue is only that the dropdown doesn't show pre-existing customers beyond the 1000 limit.

## Files Changed
- `src/components/accounting/documents/DraftQuotationEditor.tsx` — switch customer dropdown to search-on-type or increase limit

