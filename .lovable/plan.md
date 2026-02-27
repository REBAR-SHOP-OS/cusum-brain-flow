

## Fix: Auto-create local customer when clicking a QB-only customer

When you click a customer like CON-FRAME in the Accounting Customers list, the system looks up the local `customers` table by `quickbooks_id`. If no local record exists, it shows the empty "QB-Only Customer" message instead of the customer details.

### Root Cause

The `AccountingCustomers.tsx` component queries `customers` table by `quickbooks_id` (line 116-121). QB data is available (from `qb_customers` mirror), but no corresponding row exists in `customers`. The detail sheet has no way to create one.

### Solution

Replace the "QB-Only Customer" placeholder (lines 252-259) with a **"Sync This Customer"** button that auto-creates a local `customers` record using the QB data already available in the component (`customers` array from `useQuickBooksData`).

**Changes to `src/components/accounting/AccountingCustomers.tsx`:**

1. Find the selected QB customer object from the `customers` array using `selectedQbId`
2. Add a mutation that inserts a new row into the `customers` table with:
   - `name` = `DisplayName`
   - `company_name` = `CompanyName`
   - `quickbooks_id` = QB `Id`
   - `company_id` = current `companyId`
   - `status` = "active"
   - `customer_type` = "commercial"
3. Replace the static "QB-Only Customer" message with a card showing the customer name and a "Sync to Local Database" button
4. After sync, invalidate the `local_customer_by_qb` query so the `CustomerDetail` component loads automatically

### Technical Details

- The QB customer data (`DisplayName`, `CompanyName`, `Id`, `Active`) is already loaded in the `customers` prop from `useQuickBooksData`
- The `companyId` is already available via `useCompanyId()`
- No new database tables or edge functions needed — just an insert into the existing `customers` table

