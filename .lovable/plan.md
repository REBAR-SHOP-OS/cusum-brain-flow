
# Diagnosis: Customer Invoices Not Opening

## Root Cause

The **Invoices tab** (`AccountingInvoices.tsx`) only displays a table with "Email" and "Void" action buttons. There is **no click handler** on invoice rows to open a detail/preview view.

The `InvoiceTemplate` component (a full print-ready invoice detail view) already exists and works -- but it is only wired up in the separate **Documents tab** (`AccountingDocuments.tsx`). The main Invoices list never uses it.

In QuickBooks, clicking any invoice row opens the full invoice detail (as shown in the uploaded screenshots). Our app does not replicate this behavior.

## Fix

Wire up each invoice row in `AccountingInvoices.tsx` to open the `InvoiceTemplate` overlay on click -- exactly the same way `AccountingDocuments.tsx` already does.

## Technical Changes

### File: `src/components/accounting/AccountingInvoices.tsx`

1. Import `InvoiceTemplate` from `./documents/InvoiceTemplate`
2. Add state: `previewInvoice` (stores the selected invoice or null)
3. Add a `getInvoiceData()` helper (same logic already in `AccountingDocuments.tsx`) that maps a QB invoice to the `InvoiceTemplate` data shape
4. Make each `TableRow` clickable with `onClick` to set `previewInvoice`
5. Add the `InvoiceTemplate` overlay at the bottom, triggered when `previewInvoice` is set
6. Add a visual "View" button or eye icon in the Actions column so it is obvious rows are clickable

No other files or features will be modified.
