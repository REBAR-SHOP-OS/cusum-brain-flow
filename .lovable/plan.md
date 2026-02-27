

## Make Payment History Rows Clickable with Detail Dialog

### Problem
In the Invoice Editor's "Payment History" section, payment rows are plain text showing only Date and Amount. Users cannot click on them to see additional details like Payment Method, reference number, or memo.

### Changes

**File: `src/components/accounting/InvoiceEditor.tsx`**

1. **Enrich `linkedPayments` data** (lines 132-149): Expand the extracted fields to include:
   - `paymentMethod` (from `PaymentMethodRef.name`)
   - `paymentId` (the QB Payment ID)
   - `memo` (from `PrivateNote`)
   - `depositTo` (from `DepositToAccountRef.name`)
   - `refNumber` (from `PaymentRefNum`)

2. **Add a `selectedPaymentDetail` state** to track which payment row the user clicked.

3. **Make payment rows interactive**: Add `cursor-pointer hover:bg-gray-100` styling and an `onClick` handler to each `<tr>` in the Payment History table that sets the selected payment detail.

4. **Add a Payment Detail Dialog**: Render a small Dialog (using the existing `@radix-ui/react-dialog` component) that shows:
   - Date
   - Amount
   - Payment Method
   - Reference Number
   - Deposit Account
   - Memo
   - A close button

5. **Add Payment Method column to table**: Add a third "Method" column to the Payment History table header and rows, showing the payment method name inline (e.g., "Check", "Credit Card", "STRIPE") so it's visible at a glance without clicking.

### Technical Details

The `payments` prop (type `QBPayment[]`) already contains the full QB payment objects with `PaymentMethodRef`, `PaymentRefNum`, `PrivateNote`, and `DepositToAccountRef` fields. The `linkedPayments` memo just needs to extract more fields from these objects.

The dialog will use the existing `Dialog`/`DialogContent` components already imported elsewhere in the project (`@/components/ui/dialog`).

### No other files are modified
- No database changes
- No new dependencies
- Only `InvoiceEditor.tsx` is touched
