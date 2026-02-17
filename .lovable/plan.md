

# Add Payment History to Invoice Editor

## What's Missing

The QuickBooks invoice view (as shown in your screenshots) displays a **Payment History** section showing each payment date and amount applied. Our InvoiceEditor currently only shows a single "Paid" total line with no breakdown of individual payments.

## Solution

Extract linked payments from the QuickBooks data and display them in a payment history table inside the InvoiceEditor, matching the QB layout (Date | Amount Applied).

## Changes

### 1. `src/components/accounting/AccountingInvoices.tsx`
- Pass the `payments` array from the data hook to the `InvoiceEditor` component

### 2. `src/components/accounting/InvoiceEditor.tsx`
- Accept a new `payments` prop (the full QBPayment array)
- Add a `getLinkedPayments()` function that:
  - Iterates through all payments
  - Checks each payment's `Line[].LinkedTxn[]` for references to this invoice's ID
  - Extracts the date (`TxnDate`) and amount applied to this specific invoice
- Render a **Payment History** section between the totals and footer:
  - Shows "PAYMENT STATUS: PAID / PARTIAL / OPEN" badge (like QB)
  - Table with columns: **Date** and **Amount Applied**
  - Summary line: "X payments made on [latest date]"
  - Only shown when there are linked payments (hidden for unpaid invoices)

### 3. `src/hooks/useQuickBooksData.ts`
- No changes needed -- the `QBPayment` type uses `raw_json` which already contains the full QB payment object including `Line` and `LinkedTxn` arrays

## Visual Layout (matching QB)

```text
+------------------------------------------+
|  Subtotal:                    $39,750.00  |
|  Tax (HST):                    $5,167.50  |
|  ─────────────────────────────────────── |
|  Total:                       $44,917.50  |
|                                           |
|  PAYMENT HISTORY              PAID        |
|  ┌──────────────┬──────────────────┐     |
|  │ Date         │ Amount Applied   │     |
|  ├──────────────┼──────────────────┤     |
|  │ 03/10/2025   │ $6,192.40        │     |
|  │ 09/10/2025   │ $22,600.00       │     |
|  │ 29/10/2025   │ $14,012.00       │     |
|  │ 21/11/2025   │ $2,565.10        │     |
|  └──────────────┴──────────────────┘     |
|  4 payments                               |
|                                           |
|  ─────────────────────────────────────── |
|  Amount Due:                      $0.00   |
+------------------------------------------+
```

## Technical Details

QuickBooks Payment objects store linked invoices in this structure:
```json
{
  "Line": [{
    "Amount": 6192.40,
    "LinkedTxn": [{ "TxnId": "123", "TxnType": "Invoice" }]
  }]
}
```

The matching logic: for each payment, scan its `Line` array for `LinkedTxn` entries where `TxnType === "Invoice"` and `TxnId` matches the current invoice's `Id`. The `Amount` on that line is the amount applied to this specific invoice.
