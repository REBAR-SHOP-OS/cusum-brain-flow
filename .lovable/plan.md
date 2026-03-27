

# Add Delete & Packing Slip to ERP Invoices List

## Problem
The ERP Invoices table is missing:
1. **Delete button** — no way to remove invoices from the list
2. **Packing Slip button** — only QuickBooks invoices have the packing slip action; ERP invoices don't

## Changes

### `src/components/accounting/AccountingInvoices.tsx`

1. **Add Actions column** to the ERP Invoices table with:
   - **Packing Slip** button (Package icon) — opens `PackingSlipTemplate` with ERP invoice data
   - **Delete** button (Trash2 icon) — calls `remove` from `useSalesInvoices` with confirmation dialog

2. **Add delete confirmation state** — reuse `ConfirmActionDialog` pattern already in the component

3. **Build packing slip data from ERP invoice** — map `SalesInvoice` fields to `PackingSlipData` format (invoice_number, customer_name, issued_date, items placeholder)

4. **Import** `Trash2` icon and destructure `remove` from `useSalesInvoices`

### Technical details
- Add `Actions` TableHead to the ERP table header
- Each row gets two icon buttons with `e.stopPropagation()` to prevent opening editor
- Delete uses existing `ConfirmActionDialog` with a new `deleteTarget` state
- Packing slip reuses existing `PackingSlipTemplate` + `packingSlipInvoice` state (extended to accept ERP invoice data)

## Files Changed
- `src/components/accounting/AccountingInvoices.tsx` — add Actions column with delete + packing slip to ERP invoices table

