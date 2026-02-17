

# Fix: Customer Name and Payment History Not Showing in Invoice Editor

## Diagnosis

Two separate issues found after auditing the database and code:

### Problem 1: Bill To dropdown shows empty in edit mode
The customer data exists (1,946 customers in the database, including the correct one for this invoice). The Select component correctly matches `customerRef.value` ("1505") against customer IDs. However, the `SelectValue` component has no `placeholder` prop, and in some Radix Select edge cases with large option lists, the display can fail to render the matched label. Additionally, the view mode already shows the customer name correctly.

**Fix**: Add a `placeholder` to the SelectValue, and ensure the displayed value falls back to `customerRef.name` when no match is found in the customers list.

### Problem 2: Payment History section never appears
The `qb_transactions` table contains **zero Payment records** -- only 1,822 Invoices. The sync engine (`qb-sync-engine`) includes "Payment" in its `TXN_TYPES` list, meaning payments *should* sync, but either a full sync hasn't been run since payments were added to the engine, or payments failed silently during sync.

The frontend code for extracting linked payments from the `payments` array is correct -- it properly scans `Line[].LinkedTxn[]` for matching invoice IDs. But since `payments` is always an empty array, the section never renders.

**Fix**: Two changes needed:
1. Show a fallback "Paid" line (from `invoice.Balance` vs `invoice.TotalAmt`) when no linked payment records exist, so users always see payment status
2. Always show the payment status badge (PAID/PARTIAL/OPEN) regardless of whether detailed payment records are available

## Changes

### File 1: `src/components/accounting/InvoiceEditor.tsx`

**Customer display fix:**
- Add `placeholder={customerRef.name || "Select customer..."}` to the `SelectValue` component so the name always shows even if the Select can't match the value
- In view mode, already works correctly (shows `customerRef.name`)

**Payment history fix:**
- Move the payment status badge and "Paid" amount display outside the `linkedPayments.length > 0` condition
- When `linkedPayments.length > 0`: show the full payment history table (date + amount for each payment)
- When `linkedPayments.length === 0` but `paid > 0`: show a simplified "Paid" line with the total paid amount and the status badge
- Always show the "Amount Due" section with the correct remaining balance

### Summary of visual changes:
- Bill To dropdown will always show the customer name (even if the dropdown options haven't loaded yet)
- Invoices with payments will show "PAID" / "PARTIAL" badge and the paid amount, even when detailed payment records are unavailable
- When payment records are synced in the future, the full payment history table will automatically appear
