

## Show All Contacts in Sales Department

### Problem
Sales Contacts page reads from the empty `sales_contacts` table (0 rows), while 1,320 contacts exist in the main `contacts` table (linked to customers via `customer_id`).

### Solution
Update `useSalesContacts` to query from **both** `contacts` (main system) and `sales_contacts` (sales-only additions), merging them into a unified list. The `contacts` table has `first_name`, `last_name`, `email`, `phone`, `customer_id` — we join to `customers` to get `company_name`.

### Changes

**`src/hooks/useSalesContacts.ts`**
- Add a second query fetching from `contacts` table joined with `customers` for company_name
- Merge both sources into a single array, with `contacts` records mapped to the same `SalesContact` shape (concatenating `first_name + last_name` as `name`, customer's `company_name`, source = `"system"`)
- Deduplicate by email if needed
- Keep the `create` mutation writing to `sales_contacts` (new manual additions stay isolated)

**`src/pages/sales/SalesContacts.tsx`**
- Add a visual badge/indicator to distinguish system contacts from manually added ones (optional, lightweight)
- No structural changes needed — it already renders the `contacts` array from the hook

