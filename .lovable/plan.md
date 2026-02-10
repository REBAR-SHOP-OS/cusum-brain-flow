

# Sync Odoo Quotations into the Quotation UI

## What This Does
Pull all 2,586 quotations from Odoo (the `sale.order` records you showed) into a local database table, then display them in the existing Quotation tab inside Accounting Documents -- matching the layout from your Odoo screen (Number, Date, Customer, Salesperson, Total, Status).

## Steps

### 1. Add columns to the `quotes` table
The existing `quotes` table is empty and missing fields needed from Odoo. We will add:
- `salesperson` (text) -- e.g. "Swapnil Mahajan", "Saurabh Sehgal"
- `odoo_id` (integer, unique) -- deduplication key
- `odoo_status` (text) -- "Quotation Sent", "Sales Order", "Cancelled"
- `source` (text) -- to mark as "odoo_sync"
- `metadata` (jsonb) -- store extra Odoo fields
- `company_id` (uuid, FK to companies) -- for multi-tenant RLS

### 2. Create `sync-odoo-quotations` edge function
A new edge function that reuses the same XML-RPC auth + JSON-RPC fetch pattern from `sync-odoo-leads`:
- Fetches `sale.order` records from Odoo with fields: `name`, `date_order`, `partner_id`, `user_id`, `amount_total`, `state`, `company_id`
- Uses the same batch processing architecture (pagination, pre-loaded ID cache, chunked inserts, 50s time guard)
- Maps Odoo `state` values (`draft`, `sent`, `sale`, `cancel`) to display labels ("Draft", "Quotation Sent", "Sales Order", "Cancelled")
- Links to existing customers by name matching (same in-memory map approach)

### 3. Update the Quotation UI in AccountingDocuments
- Add a data source toggle: show Odoo quotations alongside (or instead of) QuickBooks estimates
- Fetch quotations from the `quotes` table using a React Query hook
- Display each quotation in the list with: Number, Date, Customer, Salesperson, Total, Status badge (color-coded like Odoo)
- Clicking "View" opens the existing QuotationTemplate with the data filled in
- Add a "Sync Odoo Quotations" button to trigger the edge function

### 4. Add "Sync Quotations" button to the Pipeline page
Add a button next to "Sync Odoo" on the Pipeline header so users can trigger quotation sync from there too.

## Technical Details

| File | Change |
|------|--------|
| Migration SQL | Add columns to `quotes` table + RLS policies |
| `supabase/functions/sync-odoo-quotations/index.ts` | New edge function for Odoo `sale.order` sync |
| `supabase/config.toml` | Register new function with `verify_jwt = true` |
| `src/hooks/useOdooQuotations.ts` | New hook to fetch quotes from DB + trigger sync |
| `src/components/accounting/AccountingDocuments.tsx` | Show Odoo quotations in the Quotation tab with status badges |
| `src/pages/Pipeline.tsx` | Add "Sync Quotations" button |

### Status Badge Colors (matching Odoo)
- **Quotation Sent** -- purple/violet badge
- **Sales Order** -- green badge  
- **Cancelled** -- gray badge
- **Draft** -- blue badge

### Estimated Sync Performance
Using the same batch architecture as leads: ~500 records per page, chunked inserts of 50. Should complete all 2,586 quotations in 2-3 runs max.
