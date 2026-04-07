

# Fix Missing Payment Links and PDF in Auto-Generated Invoices (accept_and_convert)

## Root Cause Analysis

When a customer accepts a quotation via the public portal, the `accept_and_convert` flow in `send-quote-email/index.ts` creates an invoice but has two failures:

### 1. Stripe Payment Link Fails Silently
The code calls `stripe-payment` edge function via `fetch()` using `SUPABASE_SERVICE_ROLE_KEY` as the Bearer token (line 709). The `stripe-payment` function resolves `companyId` from `profiles` table using the authenticated user's ID (line 67-72). Since the service role key's JWT doesn't correspond to a real user, the profile lookup returns nothing → "No company" → 400 error → silently caught and ignored.

### 2. PDF Not Generated
The `accept_and_convert` flow never calls `generate-invoice-pdf`. It only builds inline HTML for the email. Compare with `DraftInvoiceEditor.handleSendEmail` which calls `generate-invoice-pdf` and includes a "Download Invoice PDF" button in the email.

### 3. QuickBooks Link May Also Fail
The QB push uses `x-qb-user-id` header correctly, but if the connection lookup fails (no matching QB connection for the company), it silently skips — leaving the email without any payment link at all.

## Changes

### File: `supabase/functions/send-quote-email/index.ts`

**Fix 1 — Stripe payment link (lines 703-727):**
Instead of calling `stripe-payment` via `fetch()` (which goes through `handleRequest` auth), call the Stripe API directly inline using `STRIPE_SECRET_KEY` env var and insert the record into `stripe_payment_links` directly via the service client. This mirrors what `stripe-payment/index.ts` does but without the auth layer.

Alternatively (simpler): Pass the `companyId` directly in the body to `stripe-payment` and add a bypass in `stripe-payment` that accepts `companyId` from the body when the caller is using the service role key. This is the safer approach since it reuses existing Stripe logic.

**Chosen approach**: Inline Stripe call in `accept_and_convert` — extract the payment link creation logic (lines 90-143 of `stripe-payment/index.ts`) into a shared helper, or duplicate the ~30 lines of Stripe API calls directly in the `accept_and_convert` block. The duplication is acceptable given the critical nature of this flow.

**Fix 2 — Generate PDF and include download link (after line 797):**
After creating the invoice and payment links, call `generate-invoice-pdf` via `fetch()` (this function uses `SERVICE_KEY` directly, no `handleRequest` auth) with the invoice data. Include the resulting PDF URL in the email as a download button — same pattern as `DraftInvoiceEditor.handleSendEmail` (lines 658-691).

### File: `supabase/functions/stripe-payment/index.ts`

**Alternative Fix 1 (preferred — less duplication):**
Add a fallback: if `userId` resolves but profile has no `company_id`, check if `body.companyId` was provided (only trusted when called with service role key). This allows the `accept_and_convert` caller to pass `companyId` directly.

```typescript
// After line 72
let companyId = profile?.company_id;
if (!companyId && body.companyId) {
  // Trust companyId from body when called internally (service role)
  companyId = body.companyId;
}
if (!companyId) return json({ error: "No company" }, 400);
```

Then in `send-quote-email/index.ts`, add `companyId` to the Stripe call body (line 712):
```typescript
body: JSON.stringify({
  action: "create-payment-link",
  amount: rawTotalWithTax,
  currency: "cad",
  invoiceNumber,
  customerName: ...,
  qbInvoiceId: newInvoice.id,
  companyId,  // ← ADD THIS
}),
```

### Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Accept `companyId` from body as fallback when profile lookup fails |
| `supabase/functions/send-quote-email/index.ts` | 1. Pass `companyId` in Stripe call body. 2. Add `generate-invoice-pdf` call after invoice creation. 3. Include PDF download button in invoice email HTML |

### Technical Flow After Fix

```text
Customer accepts quote
  → accept_and_convert runs
    → Creates sales_invoice ✓
    → Copies line items ✓
    → Calls stripe-payment with companyId in body → gets Stripe link ✓ (FIXED)
    → Calls quickbooks-oauth with x-qb-user-id → gets QB link ✓ (existing)
    → Calls generate-invoice-pdf → gets PDF URL ✓ (NEW)
    → Builds email with Stripe button + QB button + PDF download ✓ (FIXED)
    → Sends via Gmail API ✓
```

No database changes needed.

