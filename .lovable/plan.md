

# Add Payment Links Section to Invoice View

## Problem
The `DraftInvoiceEditor` (sales invoice view) has no visible payment links on the invoice itself. Payment links only exist in the email body. The `PaymentLinksSection` component exists but is only used in the QuickBooks `InvoiceEditor`.

## Approach
Add a payment links block at the bottom of the invoice view (before the signature area), visible on screen but hidden in print. This will show:
- **Stripe payment link** — looked up from `stripe_payment_links` table or generated on demand
- **QuickBooks payment link** — looked up from `accounting_mirror` or invoice metadata
- **Copy to clipboard** buttons for sharing

## Changes

### `src/components/accounting/documents/DraftInvoiceEditor.tsx`

1. **Add state** for Stripe URL and QB URL (loaded during the existing `useEffect` data load):
   - Query `stripe_payment_links` for existing Stripe link
   - Query `accounting_mirror` or invoice `metadata.qb_invoice_link` for QB link

2. **Add a payment links section** between the Totals block (~line 1143) and the Signature area (~line 1146), hidden in print (`print:hidden`):
   - "Pay via Stripe" button (opens link) + copy button — or "Generate Stripe Link" if none exists
   - "Pay via QuickBooks" button (opens link) + copy button — shown only if QB link exists
   - Styled consistently with the white invoice form

3. **Generate Stripe link on demand**: Reuse the same `stripe-payment` edge function call pattern from `PaymentLinksSection`.

This keeps everything self-contained in the invoice editor without importing the QB-specific `PaymentLinksSection` component (which expects a `QBInvoice` type).

### Files
| File | Change |
|------|--------|
| `src/components/accounting/documents/DraftInvoiceEditor.tsx` | Add payment link state, lookup, and UI section |

Single file change. No backend changes needed.

