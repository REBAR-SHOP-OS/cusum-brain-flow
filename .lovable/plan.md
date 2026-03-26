

# Make Invoice Editor Match Quotation Format

## Problem
The invoice creation/editing uses a basic dialog + side drawer, while quotations use a professional branded document editor (DraftQuotationEditor). The user wants invoices to have the same format.

## Approach
Create a new `DraftInvoiceEditor.tsx` component modeled after `DraftQuotationEditor.tsx`, then wire it into `SalesInvoices.tsx` so clicking a row or "New Invoice" opens the full document editor instead of the dialog/drawer.

## Changes

### 1. New file: `src/components/accounting/documents/DraftInvoiceEditor.tsx`
A full-page document editor matching the quotation format:
- Same branded header (Rebar.Shop Inc logo + address)
- Title: "Invoice #INV-XXXX" (instead of "Quotation #...")
- Invoice Date + Due Date (instead of Quote Date + Due Date)
- Bill To section with customer dropdown (same Popover pattern from quotation editor)
- Shipping Address section
- Line items table with product dropdown (same as quotation)
- Add Line button
- Subtotal / HST / Total / Amount Due
- Purchase Order # and Sales Representative fields
- Memo/Notes section
- Save / Print / Close buttons
- Saves to `sales_invoices` table + `sales_invoice_items` for line items
- On create: auto-generates invoice number, inserts into `sales_invoices`, then opens editor
- On edit: loads existing invoice + its line items

### 2. Modify: `src/pages/sales/SalesInvoices.tsx`
- Import `DraftInvoiceEditor`
- Replace the `Dialog` for "New Invoice" with: create a draft record in `sales_invoices`, then open `DraftInvoiceEditor` with its ID
- Replace table row `onClick` to open `DraftInvoiceEditor` instead of the drawer
- Remove the `SalesInvoiceDrawer` usage (or keep for view-only on paid/cancelled)
- Remove the create dialog state and form

### Key differences from quotation editor
- Uses `sales_invoices` + `sales_invoice_items` tables (not `quotes`)
- Has "Invoice Date" and "Due Date" (not "Quote Date" and "Expiration Date")  
- Includes Purchase Order # and Sales Representative fields
- Shows "Svc Date" column in line items (per the uploaded screenshot)
- Status transitions remain accessible from the editor

## Files Changed
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — new file
- `src/pages/sales/SalesInvoices.tsx` — use DraftInvoiceEditor instead of dialog + drawer

