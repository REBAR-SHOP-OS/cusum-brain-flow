

# Fix: Include All Customers in Pipeline Contact Picker

## Problem
The "New Sales Lead" contact dropdown (`unifiedContacts`) only sources from:
1. `contacts` table (CRM contacts)
2. `sales_contacts` table (manually added sales contacts)

But actual customers like "Swapzero" and "MASTERCON INC" live in `v_customers_clean` (the customers table) and are **never loaded** into the picker.

## Solution
Merge `v_customers_clean` data into the unified contacts list in `useSalesContacts.ts`, so all three sources feed the contact picker.

## Changes

### `src/hooks/useSalesContacts.ts`
- Add a third parallel query to `v_customers_clean` (same as `useCompanies` does)
- Map customer rows to the `SalesContact` shape with `source: "customer"`
- Dedupe across all three sources by email (manual > system contacts > customers)
- This automatically makes every customer available in the pipeline's contact autocomplete

### Logic
```text
1. Fetch: sales_contacts + contacts + v_customers_clean  (3 parallel queries)
2. Map all to SalesContact shape
3. Dedupe by email: manual → system → customer priority
4. Sort by created_at desc
```

No changes needed to `SalesPipeline.tsx` — it already consumes `useSalesContacts()`.

## Files Changed

| File | Change |
|---|---|
| `src/hooks/useSalesContacts.ts` | Add `v_customers_clean` as third data source in query |

