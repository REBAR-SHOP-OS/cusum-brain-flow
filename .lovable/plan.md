

# Fix: Prevent Customer Deletion When Invoices Exist (Critical Data Integrity)

## Problem
58 invoices are already orphaned. The `accounting_mirror.customer_id_fkey` uses `ON DELETE SET NULL`, so deleting a customer silently nullifies all their invoice links. The frontend delete flow has no guard — it just fires a delete with a generic "are you sure?" dialog.

## Three-Layer Fix

### 1. Database: Change FK to RESTRICT
Alter `accounting_mirror_customer_id_fkey` from `SET NULL` to `RESTRICT`. This makes it impossible to delete a customer who has invoices — the database itself blocks it.

Also apply to `orders`, `quotes`, `leads`, `sales_invoices` (via quotation→customer chain) — the critical financial tables that should never lose their customer link.

```sql
-- accounting_mirror: SET NULL → RESTRICT
ALTER TABLE accounting_mirror DROP CONSTRAINT accounting_mirror_customer_id_fkey;
ALTER TABLE accounting_mirror ADD CONSTRAINT accounting_mirror_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

-- orders
ALTER TABLE orders DROP CONSTRAINT orders_customer_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

-- quotes  
ALTER TABLE quotes DROP CONSTRAINT quotes_customer_id_fkey;
ALTER TABLE quotes ADD CONSTRAINT quotes_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

-- leads
ALTER TABLE leads DROP CONSTRAINT leads_customer_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
```

### 2. Frontend: Pre-check before delete
In `AccountingCustomers.tsx`, update the delete mutation to first check for linked invoices/orders. If any exist, show a blocking error toast instead of proceeding.

In `CustomerDetail.tsx`, update the delete dialog to show a warning count of linked records and disable the delete button if critical links exist.

### 3. Relink the 58 orphaned invoices
Use the existing `relink-orphan-invoices` edge function to reconnect the 58 orphaned `accounting_mirror` records back to their customers using QuickBooks CustomerRef data.

## Files Changed

| File | Change |
|------|--------|
| **Migration SQL** | Alter 4 FKs from SET NULL to RESTRICT |
| `src/components/accounting/AccountingCustomers.tsx` | Add pre-delete check for linked invoices/orders (~10 lines) |
| `src/components/customers/CustomerDetail.tsx` | Query linked record counts, show warning, disable delete if links exist (~20 lines) |

## Impact
- Database-level protection against future orphaning
- UI prevents accidental deletion with clear warnings
- Existing 58 orphans can be relinked via existing tool
- No new tables or auth changes

