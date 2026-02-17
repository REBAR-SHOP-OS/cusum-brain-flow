

# Fix Edit Customer Form Parity + Invoice Viewing in Customer Sheet

## Two Issues to Fix

### Issue 1: Edit Customer form should match New Customer form
The "Local Settings" inline form inside the Customer Details tab (`CustomerDetailsForm`) only has 6 fields (Name, Company Name, Type, Status, Payment Terms, Credit Limit). The user wants the **Edit** button to open the same comprehensive form as "Add Customer" -- which already exists as `CustomerFormModal` with 30+ fields across collapsible sections (contacts, addresses, billing info, notes).

**Fix**: Replace the inline `CustomerDetailsForm` with a simple "Edit All Details" button that triggers the existing `onEdit` callback (which already opens `CustomerFormModal`). The Customer Details tab will remain read-only (showing all QB data), with the edit action routing to the full form modal.

### Issue 2: Cannot view invoices from customer account
In the customer sheet's Transaction List tab, clicking an invoice number navigates away using `window.location.href = '/accounting?tab=invoices&search=...'`, which causes a full page reload and closes the customer sheet. The user loses context.

**Fix**: Instead of navigating away, load the matching invoice data from the `qb_invoices` table and open the existing `InvoiceEditor` dialog directly within the customer sheet.

---

## Files to Change

### 1. `src/components/customers/CustomerDetail.tsx`

- **Remove** the entire `CustomerDetailsForm` component (lines 870-1018) and its schema
- **Replace** the "Local Settings" card (line 809-817) with a button that calls `onEdit()` to open the full `CustomerFormModal`
- **Update** the invoice link click handler (lines 667-677): instead of `window.location.href`, query `qb_invoices` by `doc_number` and open an `InvoiceEditor` dialog
- **Add state** for `previewInvoice` to hold the selected invoice for the editor
- **Import** `InvoiceEditor` component

### No other files change

- `CustomerFormModal` already handles both Add and Edit with all 30+ fields
- `InvoiceEditor` already supports standalone viewing
- No database changes needed

## Technical Notes

- The `onEdit` prop already exists on `CustomerDetail` and opens `CustomerFormModal` in both `Customers.tsx` and `AccountingCustomers.tsx`
- For invoice viewing, the `qb_invoices` table stores invoice data with `doc_number` field that matches the transaction list's `doc_number`
- The `InvoiceEditor` component requires a `QBInvoice`-shaped object which can be constructed from `qb_invoices.raw_json`
- Guard: if no matching invoice is found in `qb_invoices`, fall back to the existing navigation behavior

