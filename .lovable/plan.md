

# Add Editable HST (ON) 13% Tax to All Invoice and Vendor Transaction Forms

## Audit Findings

| Component | Current Tax Status | Issue |
|---|---|---|
| InvoiceEditor (edit existing invoices) | Shows "HST (ON) 13%" but read-only, computed from QB data or hardcoded 13% | Cannot edit the tax rate or override the tax amount |
| CreateTransactionDialog (new Invoice/Estimate/SalesReceipt/CreditMemo) | No tax line shown at all | User sees only subtotal as "Total", no HST applied |
| CreateVendorTransactionDialog (new Bill/Expense/SupplierCredit) | No tax line shown at all | User sees only subtotal as "Total", no HST applied |

## Plan (3 files, surgical additions only)

### 1. `src/components/accounting/InvoiceEditor.tsx`
**Make tax rate editable in edit mode.**
- Add `taxRate` state initialized from the invoice's existing tax detail (default 0.13)
- Recompute `taxAmount` as `subtotal * taxRate` when editing (preserve QB's `TotalTax` in view mode)
- In the totals section, when `editing === true`, replace the static "HST (ON) 13%" label with an editable input for the tax percentage
- Include the `TxnTaxDetail` in the `handleSave` payload so QB receives the updated tax

### 2. `src/components/customers/CreateTransactionDialog.tsx`
**Add HST tax row for line-item transaction types (Invoice, Estimate, SalesReceipt, CreditMemo).**
- Add `taxRate` state (default `0.13`) and `taxEnabled` state (default `true`)
- Add computed `taxAmount = total * taxRate` and `grandTotal = total + taxAmount`
- In the footer area of the line items grid, show:
  - A row: `HST (ON)` label + editable percentage input + computed tax amount
  - Update "Total" display to show `grandTotal`
- In `handleSubmit`, include `taxRate` and `taxAmount` in the body sent to the edge function
- Payment type is excluded (no line items, no tax)

### 3. `src/components/accounting/CreateVendorTransactionDialog.tsx`
**Same tax row for vendor transactions with line items (Bill, Expense, SupplierCredit).**
- Add `taxRate` state (default `0.13`) and `taxEnabled` state (default `true`)
- Add computed `taxAmount = total * taxRate` and `grandTotal = total + taxAmount`
- Show the same HST row in the line items footer
- Include `taxRate` and `taxAmount` in the submitted body
- Cheque type is excluded (no line items, no tax)

## Technical Details

**Tax row UI (shared pattern for both Create dialogs):**
```text
+--------------------------------------+
| [x] HST (ON)  [ 13 ]%   $XX.XX      |
|                   Grand Total: $XX.XX |
+--------------------------------------+
```
- Checkbox to toggle tax on/off
- Editable numeric input for the percentage (guards: min 0, max 100, step 0.01)
- Computed tax amount (read-only display)

**InvoiceEditor tax edit UI:**
```text
Subtotal:                    $X,XXX.XX
HST (ON) [ 13.00 ]%:        $X,XXX.XX   <-- input replaces static label
Total:                       $X,XXX.XX
```

**Guards and safety:**
- Tax rate clamped between 0-100 with `Math.max(0, Math.min(100, value))`
- Default 13% per Ontario HST compliance requirement
- No database schema changes
- No changes to edge function signatures (tax fields are additive in the body)
- Existing `onCreated` callback payloads remain backward-compatible (totalAmount now includes tax)

## Files Modified

| File | Change |
|---|---|
| `src/components/accounting/InvoiceEditor.tsx` | Add editable tax rate input in edit mode |
| `src/components/customers/CreateTransactionDialog.tsx` | Add HST tax row with toggle + editable rate |
| `src/components/accounting/CreateVendorTransactionDialog.tsx` | Add HST tax row with toggle + editable rate |

