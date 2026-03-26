

# Add Send Email, Customer Accept & Convert-to-Invoice Flow

## Overview
Add UI buttons to the quotation editor and drawer so users can email quotes to customers, mark them as accepted, and auto-convert to invoices with Stripe payment links — all without going through the AI agent.

## Changes

### 1. DraftQuotationEditor — Add "Send to Customer" button
**File:** `src/components/accounting/documents/DraftQuotationEditor.tsx`

- Add `Send Email` button next to Save Draft in the top action bar
- On click: show a small dialog/popover asking for customer email
- Calls `supabase.functions.invoke("gmail-send")` with a branded HTML email containing quote details (number, line items, totals, notes/terms)
- After send: update the `quotes` table status and show success toast
- Add `Mail` icon import from lucide-react
- Add state for `sendingEmail`, `emailDialogOpen`, `customerEmail`

### 2. SalesQuotationDrawer — Wire "Send to Customer" transition to actually send email
**File:** `src/components/sales/SalesQuotationDrawer.tsx`

- When user clicks "Send to Customer" button (status transition to `sent_to_customer`):
  - Show a dialog asking for customer email address
  - Call `gmail-send` edge function with branded quotation email HTML
  - Then update status to `sent_to_customer`
- Add email input dialog state

### 3. SalesQuotationDrawer — "Customer Approved" triggers convert-to-invoice
**File:** `src/components/sales/SalesQuotationDrawer.tsx`

- When user clicks "Customer Approved" (transition to `customer_approved`):
  - Show dialog asking for customer email (pre-filled if available)
  - Call the existing `convert_quotation_to_invoice` logic:
    1. Create `sales_invoices` record (INV-YYYYNNNN)
    2. Call `stripe-payment` edge function to generate payment link
    3. Send branded invoice email via `gmail-send` with Pay Now button
  - Update quotation status to `customer_approved`
  - Show success toast with invoice number

### 4. New edge function: `send-quote-email`
**File:** `supabase/functions/send-quote-email/index.ts`

A lightweight edge function that:
- Accepts `{ quote_id, customer_email, action }` where action is `"send_quote"` or `"convert_to_invoice"`
- For `send_quote`: fetches quote data, builds branded HTML, sends via gmail-send, updates status
- For `convert_to_invoice`: reuses the exact logic from agentToolExecutor (create invoice, Stripe link, send email, update status)
- This avoids duplicating the complex HTML/email logic in the frontend

### 5. UI flow summary

```text
DraftQuotationEditor:
  [Save Draft] [📧 Send to Customer] [Print/PDF] [✕]
                    ↓
         Enter customer email → Send branded quote email

SalesQuotationDrawer (internally_approved status):
  [Send to Customer] → Enter email → sends email + updates status

SalesQuotationDrawer (sent_to_customer status):
  [Customer Approved] → Enter email → creates invoice + Stripe link + sends invoice email
  [Customer Revision] → back to draft
  [Customer Rejected] → marks rejected
```

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — new edge function for send/convert
- `src/components/accounting/documents/DraftQuotationEditor.tsx` — add Send Email button + dialog
- `src/components/sales/SalesQuotationDrawer.tsx` — intercept send_to_customer and customer_approved transitions with email dialogs

## Technical Notes
- Reuses existing `gmail-send` and `stripe-payment` edge functions
- Same branded email HTML as the agent tool executor (consistent look)
- No new DB tables needed — uses existing `sales_invoices`, `sales_quotations`, `quotes`
