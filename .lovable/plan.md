

# Add Customer Quote Acceptance Page with Terms & Convert to Invoice

## Overview
Create a public-facing page where customers can view their quotation, read and accept Terms & Conditions, which then converts the quote to an invoice and emails the customer a payment link. The quotation email will include an "Accept Quote" button linking to this page.

## Changes

### 1. New public page: `src/pages/AcceptQuote.tsx`
- Route: `/accept-quote/:quoteId` (public, no auth required)
- Fetches quote data via a new edge function (anonymous access)
- Displays: quotation number, customer name, line items table, totals, notes/terms
- Shows Terms & Conditions section with link to https://www.crm.rebar.shop/terms
- Checkbox: "I have read and accept the Terms & Conditions"
- "Accept & Confirm Order" button (disabled until checkbox is checked)
- On accept: calls `send-quote-email` with `action: "convert_to_invoice"` — creates invoice, Stripe payment link, sends invoice email
- Shows success state: "Your order has been confirmed. Invoice and payment link sent to your email."
- Shows error/expired/already-accepted states

### 2. New edge function: `supabase/functions/quote-public-view/index.ts`
- Anonymous access (no auth required)
- Accepts `{ quote_id }`, returns quote details (number, customer name, line items, totals, valid_until, status)
- Only returns data if quote status is `sent` or `sent_to_customer` — rejects if already accepted/expired/cancelled
- Minimal data exposure (no internal IDs, company details, etc.)

### 3. Update `supabase/functions/send-quote-email/index.ts`
- Add `action: "accept_and_convert"` — same as `convert_to_invoice` but callable without auth (uses service role internally)
- Validates quote is in `sent`/`sent_to_customer` status before converting
- The quotation email (`send_quote` action) now includes an "Accept Quote" button linking to the public accept page URL

### 4. Update quotation email HTML in `send-quote-email`
- Add a prominent "Review & Accept Quote" button after the line items table
- Links to `{app_url}/accept-quote/{quote_id}`
- Styled consistently with existing email branding

### 5. Register route in `src/App.tsx`
- Add `/accept-quote/:quoteId` as a public route (no auth wrapper)

## Flow
```text
1. User clicks "Send to Customer" → email sent with "Review & Accept Quote" button
2. Customer clicks button → lands on /accept-quote/:quoteId
3. Customer sees quote details + Terms & Conditions link
4. Customer checks "I accept the Terms" checkbox
5. Customer clicks "Accept & Confirm Order"
6. Backend: creates invoice → generates Stripe payment link → sends invoice email
7. Customer sees confirmation message
8. Customer receives invoice email with "Pay Now" button
```

## Files Changed
- `src/pages/AcceptQuote.tsx` — new public acceptance page
- `src/App.tsx` — add public route
- `supabase/functions/quote-public-view/index.ts` — new edge function for anonymous quote viewing
- `supabase/functions/send-quote-email/index.ts` — add accept button to quote email, add `accept_and_convert` action

