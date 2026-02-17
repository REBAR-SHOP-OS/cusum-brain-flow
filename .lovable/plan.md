
# Fix Vendors: Full Detail View, Vendor Transactions, and Separate Vendor Payments

## Problems Found

1. **Vendors tab is read-only** -- no clickable rows, no detail slide-over, no transaction list. Compared to QuickBooks (your screenshots), it's missing: Transaction List, Supplier Details, Notes tabs, and the "New transaction" dropdown (Bill, Expense, Cheque, Supplier Credit).

2. **Payments tab shows CUSTOMER payments in the Vendor section** -- The nav menu "Vendors > Vendor Payments" routes to the same `AccountingPayments` component which only displays `QBPayment` (which has `CustomerRef`). Vendor payments (Bill Payments) are a completely different entity type and are not shown at all.

3. **No VendorDetail component exists** -- CustomerDetail was built with full QB data, transaction list, editable fields, notes, and "New transaction" creation. Vendors have nothing equivalent.

---

## What Will Be Built

### 1. New Component: `VendorDetail.tsx`
A full-featured vendor detail slide-over (matching the QuickBooks Supplier detail view from your screenshots), containing:

- **Header**: Vendor name, company, active/inactive badge, open balance, overdue payment summary
- **Contact info**: Email, phone, billing address (from `qb_vendors.raw_json`)
- **"New transaction" dropdown**: Bill, Expense, Cheque, Supplier Credit (mapped to existing `create-bill` backend action)
- **Tabs**:
  - **Transaction List** -- Bills and Bill Payments for this vendor from `qb_transactions` (filtered by `vendor_qb_id`), with type/status filters, showing Date, Type, No., Payee, Category, Total Before Tax, Sales Tax, Total, and Action columns
  - **Supplier Details** -- Full QB fields from `raw_json` (company, billing address, Bill Pay ACH info, terms, tax info, currency, metadata)
  - **Notes** -- Read/display QB notes from `raw_json`

### 2. Update `AccountingVendors.tsx`
- Add QB-style **summary bar** at top with 3 stat cards: Overdue (orange), Open Bills (gray), Paid Last 30 Days (green) -- matching your screenshot
- Add **Phone** and **Email** columns to the table (from `QBVendor` data)
- Add **Action column** with "Create bill" / "Make payment" contextual links
- Make rows **clickable** to open `VendorDetail` in a Sheet slide-over
- Add vendor lookup from `qb_vendors` table for full `raw_json` data in the detail view

### 3. New Component: `CreateVendorTransactionDialog.tsx`
Similar to `CreateTransactionDialog` but for vendor-specific transaction types:
- **Bill**: Vendor ID, line items (description, qty, unit price), due date, memo -- calls `create-bill`
- **Expense**: Same structure, calls `create-bill` with expense category
- **Cheque**: Amount, memo -- calls `create-bill` variant
- **Supplier Credit**: Line items, memo -- similar to credit memo but vendor-side

### 4. Fix: Separate Vendor Payments Tab
- Create new `AccountingVendorPayments.tsx` component that shows **Bill Payment** transactions from `qb_transactions` where `entity_type = 'BillPayment'` and `vendor_qb_id IS NOT NULL`
- Update `AccountingNavMenus.tsx` to route "Vendor Payments" to a new `vendor-payments` tab instead of reusing `payments`
- Update `AccountingWorkspace.tsx` to render the new component for the `vendor-payments` tab
- The existing `AccountingPayments` continues to show customer payments only

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/accounting/VendorDetail.tsx` | **New** -- Full vendor detail view with tabs (Transaction List, Supplier Details, Notes) |
| `src/components/accounting/CreateVendorTransactionDialog.tsx` | **New** -- Dialog for creating Bills, Expenses, Cheques, Supplier Credits |
| `src/components/accounting/AccountingVendors.tsx` | **Major update** -- Summary bar, phone/email/action columns, clickable rows, Sheet with VendorDetail |
| `src/components/accounting/AccountingVendorPayments.tsx` | **New** -- Vendor-specific payments (Bill Payments from qb_transactions) |
| `src/components/accounting/AccountingNavMenus.tsx` | Fix "Vendor Payments" to route to `vendor-payments` tab |
| `src/pages/AccountingWorkspace.tsx` | Add `vendor-payments` tab rendering |

## Technical Details

- `VendorDetail` queries `qb_vendors` by `qb_id` to get `raw_json` for all vendor fields (company, address, phone, email, terms, tax ID, currency, ACH info)
- Vendor transactions are loaded from `qb_transactions` where `vendor_qb_id = vendorQbId` (entity types: Bill, BillPayment, PurchaseOrder, VendorCredit)
- The `CreateVendorTransactionDialog` calls `supabase.functions.invoke("quickbooks-oauth", { body: { action: "create-bill", vendorId, vendorName, lineItems, dueDate, memo } })` using the existing backend handler
- Pattern learning system from `transaction_patterns` table is reused for vendor transactions too
- No database schema changes needed -- all data already exists in `qb_vendors` and `qb_transactions` tables
