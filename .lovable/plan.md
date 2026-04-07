

# Add Record Payment + Enforce Dual Payment Links on All Invoices

## Overview

Two changes:
1. **Record Payment (ReceivePayment)** — Add ability for office staff to manually record customer payments (check, wire, e-transfer, cash) against an invoice, syncing to QuickBooks as a `ReceivePayment` entity.
2. **Enforce dual payment links** — Every outgoing invoice email MUST include both Stripe AND QuickBooks payment buttons. If either fails to generate, show a warning before sending (but allow override).

---

## 1. Record Payment Feature

### Backend: `supabase/functions/quickbooks-oauth/index.ts`

Add new action `"receive-payment"` in the router (next to `create-bill-payment`):

**New handler `handleReceivePayment`:**
- Accepts: `invoiceId` (QB ID), `amount`, `paymentMethod` (Check/CreditCard/Cash/ETransfer), `referenceNumber`, `memo`, `paymentDate`
- Looks up the QB invoice to get `CustomerRef` and `Balance`
- Creates a QB `Payment` entity:
  ```
  POST /v3/company/{realmId}/payment
  {
    CustomerRef: { value: customerId },
    TotalAmt: amount,
    Line: [{ Amount: amount, LinkedTxn: [{ TxnId: invoiceId, TxnType: "Invoice" }] }],
    PaymentMethodRef: { value: methodId },
    PaymentRefNum: referenceNumber,
    TxnDate: paymentDate,
    PrivateNote: memo
  }
  ```
- After success: update `sales_invoices` status to `"paid"` if full payment, or keep `"sent"` if partial
- Returns the created payment details

### Frontend: `src/components/accounting/documents/DraftInvoiceEditor.tsx`

Add a **"Record Payment"** button next to the Send Email button (visible when status is `"sent"` or `"draft"` with amount > 0):

**New dialog `RecordPaymentDialog`** (inline in same file or separate component):
- Fields: Amount (pre-filled with total), Payment Method (dropdown: Check, Credit Card, Cash, E-Transfer, Wire), Reference # (optional), Date (default today), Memo (optional)
- On submit: calls `quickbooks-oauth` with action `"receive-payment"`
- On success: updates local status to `"paid"`, shows toast, invalidates queries

### Frontend: `src/components/accounting/PaymentLinksSection.tsx`

Add a "Record Payment" button below the payment links for the QB InvoiceEditor view too.

---

## 2. Enforce Dual Payment Links on All Outgoing Invoices

### File: `src/components/accounting/documents/DraftInvoiceEditor.tsx`

In `handleSendEmail` (~line 406-575):

**Before dispatching the email**, check if both links were obtained:
- If `paymentUrl` (Stripe) is missing → show warning in the email dialog: "⚠ Stripe link unavailable"
- If `qbPayUrl` (QuickBooks) is missing → show warning: "⚠ QuickBooks link unavailable"
- If EITHER is missing → change "Send" button to "Send Anyway" (orange) with tooltip explaining a link is missing
- If BOTH present → green "Send" button as normal

**Add state variables:**
- `stripeReady: boolean` and `qbReady: boolean` — set during the link generation phase
- `linkCheckDone: boolean` — gates the send button until both checks complete

**Flow change:**
1. When email dialog opens → immediately start generating both links in parallel
2. Show spinners next to each link status
3. When both resolve → enable the send button with appropriate color

### File: `supabase/functions/send-quote-email/index.ts`

The quote acceptance flow already generates both links (lines 398-530). Add a `warnings` array to the response when either link fails, so the UI can surface it.

---

## Technical Details

| Change | File | Impact |
|--------|------|--------|
| `receive-payment` handler | `quickbooks-oauth/index.ts` | ~60 lines, new case in router |
| Record Payment dialog | `DraftInvoiceEditor.tsx` | ~80 lines new dialog + button |
| Pre-flight link check | `DraftInvoiceEditor.tsx` | ~30 lines in handleSendEmail |
| Link status UI | `DraftInvoiceEditor.tsx` | ~20 lines in email dialog |
| Warning passthrough | `send-quote-email/index.ts` | ~5 lines |

## Impact
- 3 files changed (1 edge function, 1 component, 1 edge function minor)
- No database schema changes (uses existing `sales_invoices.status`)
- No new tables needed
- QuickBooks ReceivePayment API is standard — same auth flow as BillPayment

