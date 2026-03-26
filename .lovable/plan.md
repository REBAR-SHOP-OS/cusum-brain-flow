

# Fix: "Send Quotation to Customer" Edge Function Failure

## Root Cause

The `send-quote-email` edge function has **zero logs** — it either failed to deploy or is returning errors that the Supabase SDK swallows silently.

Two issues to fix:

### Issue 1: Frontend uses `supabase.functions.invoke()` instead of `invokeEdgeFunction`
The SDK swallows non-2xx response bodies, so the real error is hidden behind "Failed to send a request to the Edge Function." The project already has `invokeEdgeFunction` which bypasses this limitation — both call sites should use it.

### Issue 2: Internal `gmail-send` call missing `apikey` header
On line 112-114, the function calls `gmail-send` via raw fetch but only passes `Authorization`. Supabase edge functions require the `apikey` header too. Same issue on line 255 for the invoice email.

## Changes

### 1. `supabase/functions/send-quote-email/index.ts`
- Add `apikey` header to both internal `gmail-send` fetch calls (lines 114 and 256):
  ```ts
  apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
  ```

### 2. `src/components/accounting/documents/DraftQuotationEditor.tsx`
- Replace `supabase.functions.invoke("send-quote-email", ...)` with `invokeEdgeFunction("send-quote-email", ...)` for better error visibility

### 3. `src/components/sales/SalesQuotationDrawer.tsx`
- Same replacement: use `invokeEdgeFunction` instead of `supabase.functions.invoke`

### 4. Deploy
- Redeploy `send-quote-email` to ensure it's live

## Files Changed
- `supabase/functions/send-quote-email/index.ts`
- `src/components/accounting/documents/DraftQuotationEditor.tsx`
- `src/components/sales/SalesQuotationDrawer.tsx`

