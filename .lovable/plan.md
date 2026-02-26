

## Changes Overview

This plan adds drag-and-drop upload zones to all four main tabs, reorders the Documents sub-tabs to put Packing Slips first, adds action buttons, and wires the Quotation → Invoice → Packing Slip flow.

### 1. Add DocumentUploadZone to Invoices tab
In `AccountingInvoices.tsx`, import `DocumentUploadZone` and add it below the search bar (before the stats cards). Target type: `"invoice"`.

### 2. Add DocumentUploadZone to Customers tab
In `AccountingCustomers.tsx`, import `DocumentUploadZone` and add it below the search bar. Target type: `"customer"`.

### 3. Bills tab already has DocumentUploadZone
Already present in `AccountingBills.tsx` — no change needed.

### 4. Reorder Documents sub-tabs: Packing Slips first
In `AccountingDocuments.tsx`, reorder the `docTabs` array to: `packing-slip`, `invoice`, `quotation`. Set default `activeDoc` to `"packing-slip"`.

### 5. Add "Print Packing Slip" button to Invoices table actions
In `AccountingInvoices.tsx`, add a `Package` icon button per invoice row that opens the `PackingSlipTemplate` overlay directly from the Invoices tab. Import `PackingSlipTemplate` and add the same `getPackingSlipData` helper.

### 6. Add "Add Packing Slip" and "Add New Quotation" buttons
- In `AccountingDocuments.tsx`, add a `+ Add Packing Slip` button (visible when on `packing-slip` tab) and `+ Add New Quotation` button (visible when on `quotation` tab) next to the doc type tab buttons.
- The "Add New Quotation" button will open the `CustomerSelectDialog` → `CreateTransactionDialog` with type `"Estimate"`.
- The "Add Packing Slip" button will open a similar flow selecting an invoice to generate a packing slip from.

### 7. Wire Quotation → Invoice → Packing Slip flow
In the quotation list (within `AccountingDocuments.tsx`), for quotations with status "Sales Order", add a `→ Create Invoice` action button that calls QuickBooks to convert the estimate to an invoice. This uses the existing `qb-sync-engine` edge function. After invoice creation, offer a "Print Packing Slip" action.

### Technical Details
- `PackingSlipTemplate` is already built and reusable
- `DocumentUploadZone` is a self-contained component accepting `targetType` and `onImport` props
- `CustomerSelectDialog` + `CreateTransactionDialog` pattern already exists in `AccountingInvoices.tsx`
- The packing slip print from invoices reuses `getPackingSlipData()` logic from `AccountingDocuments.tsx`

