

# Add Both Payment Links (Stripe + QuickBooks) to Invoice Emails

## Problem
Currently, invoice emails only include a Stripe "Pay Now" button. The user wants both Stripe and QuickBooks payment links in the email — matching the dual-payment approach already used in `PaymentLinksSection.tsx`.

## Changes

### 1. `supabase/functions/send-quote-email/index.ts` — Add QB link to accept_and_convert email

After the Stripe payment link is generated (line 538-562), look up the QuickBooks invoice link from `accounting_mirror` by matching the invoice number. Build a two-button payment section:
- **Pay via Stripe** button (existing)
- **Pay via QuickBooks** button (new — uses QB's `InvoiceLink` field from mirror data, or falls back to `https://app.qbo.intuit.com/app/customerbalance?invoiceId=<qb_id>`)

Replace the single `payNowButton` (line 638-643) with a dual-button HTML block showing both options side by side.

### 2. `src/components/accounting/documents/DraftInvoiceEditor.tsx` — Add QB link to manual Send Email

In `handleSendEmail` (around line 367-387), after Stripe link lookup, also query `accounting_mirror` for matching QB invoice by `DocNumber`. Extract the `InvoiceLink` or build a QB payment URL from the QuickBooks ID.

Update the `payBtnHtml` (line 382-387) to show two buttons when both links are available:
- Stripe "Pay Now" button
- QuickBooks "Pay via QuickBooks" button

### Email HTML Layout
```text
┌──────────────────────────────────────┐
│  💳 Pay via Stripe - $107,194.20     │
│  Secure payment powered by Stripe    │
│                                      │
│  📋 Pay via QuickBooks               │
│  Pay through QuickBooks Online       │
└──────────────────────────────────────┘
```

Both buttons are stacked vertically, each with its own branding. If either link is unavailable, only the available one shows.

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — add QB payment link lookup + dual button HTML
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — add QB link lookup + dual button in manual email

