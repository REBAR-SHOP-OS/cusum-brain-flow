

# Fix Domain & Add Invoice Redirect After Acceptance

## Changes

### 1. Replace all `crm.rebar.shop` references with `erp.rebar.shop`

**Files affected:**
- `supabase/functions/send-quote-email/index.ts` — `APP_URL` constant
- `supabase/functions/ai-generate-quotation/index.ts` — terms URL
- `src/pages/AcceptQuote.tsx` — terms links (2 occurrences)
- `src/components/landing/QuoteRequestBanner.tsx` — contact links (2 occurrences)
- `src/components/landing/LandingFooter.tsx` — contact link

### 2. After acceptance, redirect to invoice page

In `src/pages/AcceptQuote.tsx`, after the `accept_and_convert` call succeeds:
- If the response includes an `invoice_id`, redirect to `/accept-quote/:quoteId/invoice` or show the invoice inline with the payment link prominently displayed
- Better approach: redirect directly to the payment link if available, since the customer's goal is to pay. Show a brief "Order Confirmed" screen for 2-3 seconds with auto-redirect to the Stripe payment link
- Keep a manual "Pay Now" button as fallback if auto-redirect doesn't fire

Updated success flow:
```
Accept clicked → API returns invoice_number + payment_link
→ Show "Order Confirmed! Redirecting to payment..." for 2s
→ Auto-redirect to payment_link (window.location.href)
→ Fallback "Pay Now" button visible immediately
```

### 3. Backend: return invoice_id in accept_and_convert response

Ensure `send-quote-email` returns `invoice_id` alongside `invoice_number` and `payment_link` so the frontend can construct a redirect if needed.

## Files Changed
- `supabase/functions/send-quote-email/index.ts`
- `supabase/functions/ai-generate-quotation/index.ts`
- `src/pages/AcceptQuote.tsx`
- `src/components/landing/QuoteRequestBanner.tsx`
- `src/components/landing/LandingFooter.tsx`

