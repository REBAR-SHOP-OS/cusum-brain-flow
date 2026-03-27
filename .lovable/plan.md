

# Fix: Show Sales Invoices in Invoice List + Fix Email Delivery

## Two Issues Found

### Issue 1: Invoices Not Visible
The `AccountingInvoices` component only renders **QuickBooks invoices** (from `useQuickBooksData`). The `sales_invoices` table has 3 records (INV-20260001 through 003) but they are never displayed in the list. The "Create Invoice" button inserts into `sales_invoices` and opens the editor, but there is no listing of these records.

**Fix:** Add a section to `AccountingInvoices.tsx` that queries and displays `sales_invoices` records alongside QuickBooks invoices. This will show a "Local Invoices" section (or merge them into the same table) so all invoices are visible.

### Issue 2: Invoice Email Not Sent After Acceptance
Edge function logs show:
```
[sendEmailDirectViaGmail] Token refresh failed: {"error":"invalid_grant","error_description":"Bad Request"}
```
The Gmail refresh token stored in `user_gmail_tokens` has **expired or been revoked**. This is a credentials issue, not a code bug.

**Fix:** The user needs to **re-authorize their Gmail connection** to get a fresh token. No code change needed for this — just re-connect Gmail.

## Plan

### 1. `src/components/accounting/AccountingInvoices.tsx` — Show sales_invoices in the list

- Import `useSalesInvoices` hook (already imported but only used for `generateNumber`)
- Use the `invoices` array from `useSalesInvoices` to render local/ERP invoices
- Add a "Local Invoices" card/table below the QuickBooks invoices table (or above it)
- Each row shows: invoice_number, customer_name, amount, status, created_at
- Clicking a row opens `DraftInvoiceEditor` (already wired up via `editorInvoiceId`)
- Include status badges matching existing patterns (draft, sent, paid)

### 2. Gmail Token — Re-authorize

The `invalid_grant` error means the stored Gmail refresh token is no longer valid. The user must re-authorize their Gmail integration to refresh the token. After re-authorization, the `accept_and_convert` email flow will work.

## Files Changed
- `src/components/accounting/AccountingInvoices.tsx` — add sales_invoices listing section

