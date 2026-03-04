

# App-Wide Customer Compatibility Layer

## Overview
Create SQL views and a helper function that give every module (Accounting, CRM, Orders, Deliveries, RFQ, Inbox) a clean "companies only" read layer — without touching any existing tables or breaking legacy `customer_id` references. Then update all frontend read queries to use `v_customers_clean` instead of the raw `customers` table.

## Step 1: Database Migration — Views + Trigger

### A) `norm_text()` helper function
Immutable text normalizer for matching company names across comma-split and clean records.

### B) `normalized_name` column on `customers`
Add column + backfill from `coalesce(company_name, name)`. Uses existing `status` column (no need for separate `archived` boolean).

### C) `v_customers_clean` — Clean company read source
```sql
SELECT id as customer_id, name as display_name, 
       coalesce(nullif(company_name,''), name) as company_name,
       normalized_name, phone, email, status, company_id, created_at
FROM customers
WHERE status != 'archived'
  AND merged_into_customer_id IS NULL
  AND position(', ' in name) = 0;
```
Every dropdown/list across the app reads from this view.

### D) `v_customer_company_map` — Legacy ID mapper
Maps every `customer_id` (including "Company, Person" comma rows) to the correct clean company record. Non-comma customers map to themselves.

### E) `v_orders_enriched` — Orders with resolved company
```sql
SELECT o.*, m.company_customer_id, cc.name as company_name
FROM orders o
LEFT JOIN v_customer_company_map m ON m.legacy_customer_id = o.customer_id
LEFT JOIN customers cc ON cc.id = m.company_customer_id;
```

### F) `v_leads_enriched` — CRM leads with company resolution
Same pattern: joins leads → customers to surface `customer_name`, `customer_company_name`.

### G) `v_communications_enriched` — Comms with customer/contact info
Joins communications → customers + contacts for resolved company/contact names.

### H) Comma-name prevention trigger
`BEFORE INSERT OR UPDATE` on `customers`: if name contains `", "` pattern, auto-splits into company record + contact record. Prevents future duplicate creation at the source.

### I) Chatter tables
- `chat_threads` (id, company_id, project_id, customer_id, subject, created_by, timestamps)
- `chat_thread_messages` (id, thread_id, sender_profile_id, body, metadata, created_at)
- `chat_thread_links` (id, thread_id, entity_type, entity_id) — polymorphic link table, "no-loss guarantee"
- RLS policies scoped by `company_id` for authenticated users

## Step 2: Frontend — Swap Customer Reads to View

Replace `from("customers")` with `from("v_customers_clean")` in **read-only** queries across these files (17 files total):

| File | What changes |
|------|-------------|
| `src/pages/Customers.tsx` | Main customer list query |
| `src/components/customers/CustomerFormModal.tsx` | Customer dropdown (reads only) |
| `src/components/estimation/TakeoffWizard.tsx` | Customer select |
| `src/components/office/ProductionQueueView.tsx` | Customer name lookup |
| `src/components/office/AIExtractView.tsx` | Customer list for matching |
| `src/components/chat/MentionMenu.tsx` | @mention customer search |
| `src/components/accounting/AccountingCustomers.tsx` | Accounting customer list |
| `src/hooks/useCEODashboard.ts` | Active customer count |
| `src/hooks/useQuickBooksData.ts` | QB sync customer list |
| `src/hooks/useVendorPortalData.ts` | Vendor portal customer fetch |
| `src/hooks/useCustomerPortalData.ts` | Customer portal fetch |
| `src/pages/CustomerAction.tsx` | Customer detail page |

**Write operations stay on `customers` table** — inserts/updates continue writing to the real table. Only reads switch to the view.

### Centralized query helper
Add `src/hooks/useCompanies.ts`:
```typescript
export function useCompanies(search?: string) {
  return useQuery({
    queryKey: ["companies", search],
    queryFn: async () => {
      let q = supabase.from("v_customers_clean").select("*");
      if (search) q = q.or(`display_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
```
Modules can gradually adopt this hook instead of inline queries.

## Step 3: Update merge_customers in edge function

Add `chat_threads.customer_id` to the re-link list in `vizzy-erp-action`.

## Files Changed

| File | Change |
|------|--------|
| Database migration | Views, trigger, chatter tables, normalized_name column |
| `supabase/functions/vizzy-erp-action/index.ts` | Add `chat_threads` to merge re-link |
| `src/hooks/useCompanies.ts` | New centralized hook |
| 12 frontend files | Swap read queries from `customers` → `v_customers_clean` |

## What This Does NOT Touch
- No deletes of any data
- No QB/Odoo writes or sync triggers
- No changes to `quickbooks_id` or integration columns
- Write operations continue targeting the `customers` table directly

