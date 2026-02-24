

## Enhance Payments Screen: Outstanding Invoices + Date of Payment

### Problem
1. The **Payments** tab in Accounting does not show outstanding (unpaid) invoices for a selected customer -- it only lists already-received payments.
2. When recording a new payment (via `CreateTransactionDialog`), there is no "Date of Payment" input field, so all payments default to today's date in QuickBooks.

### Solution

#### 1. Add Customer Filter + Outstanding Invoices to AccountingPayments

**File: `src/components/accounting/AccountingPayments.tsx`**

- Add a customer dropdown (Select) that filters payments by `CustomerRef.value`
- When a customer is selected, display their outstanding invoices (from `data.invoices` where `Balance > 0` and matching `CustomerRef.value`) in a separate section above or beside the payments table
- Show each outstanding invoice's doc number, date, total, and open balance
- Include a summary card showing total outstanding balance for the selected customer

#### 2. Add "Date of Payment" Field to CreateTransactionDialog

**File: `src/components/customers/CreateTransactionDialog.tsx`**

- Add a `txnDate` state field (defaulting to today's date)
- Render a date input labeled "Date of Payment" in the Payment form section (alongside the existing Payment Method and Amount fields)
- Pass `txnDate` in the submission body when `type === "Payment"`

#### 3. Accept TxnDate in the Edge Function

**File: `supabase/functions/quickbooks-oauth/index.ts`**

- In `handleCreatePayment`, extract `txnDate` from the request body
- If provided, add `TxnDate: txnDate` to the QuickBooks API payload so the payment is recorded with the correct date

### Technical Details

| File | Change |
|---|---|
| `src/components/accounting/AccountingPayments.tsx` | Add customer selector, outstanding invoices panel using existing `data.invoices` filtered by customer + balance > 0 |
| `src/components/customers/CreateTransactionDialog.tsx` | Add `txnDate` state + date input for Payment type, pass in body |
| `supabase/functions/quickbooks-oauth/index.ts` | Accept `txnDate` param, include `TxnDate` in QB payment payload |

### Data Flow
- Outstanding invoices are already available via `data.invoices` (QBInvoice[]) in the accounting hook -- no new queries needed
- The customer list is already available via `data.customers`
- The edge function already handles `create-payment` -- just needs the additional `TxnDate` field

### What is NOT Changed
- No database schema changes
- No changes to other pages or components
- No changes to the Customer Portal invoice display
- No changes to BillPaymentDialog (vendor-side payments)
