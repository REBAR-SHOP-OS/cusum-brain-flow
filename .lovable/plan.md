

# Fix: `qbInvoiceLink is not defined` Error on Quote Acceptance

## Root Cause
The variable `qbInvoiceLink` is declared at line 579 inside the `else` block (new invoice creation path). But it's referenced at line 689 in the shared email-building code that runs for BOTH new and re-acceptance paths. On re-acceptance, the variable doesn't exist — causing the runtime error shown in the screenshot.

## Fix

### `supabase/functions/send-quote-email/index.ts`

1. Move `let qbInvoiceLink = "";` from line 579 (inside `else`) to line 435 (alongside `stripePaymentUrl`), so it's in scope for both code paths
2. Remove the duplicate declaration at line 579
3. The QB push logic (lines 580-612) stays inside the `else` block — it only runs for new invoices, which is correct

This is a one-line scope fix. No logic changes needed.

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — move variable declaration to shared scope

