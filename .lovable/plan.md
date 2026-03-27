

# Fix: Invoice Email Not Sent After Quote Acceptance

## Root Cause — Two Issues

### Issue 1: `gmail-send` requires user auth, but `accept_and_convert` calls it with service role key
When a customer accepts a quote publicly (no logged-in user), `accept_and_convert` calls `gmail-send` with `Authorization: Bearer <SERVICE_ROLE_KEY>`. But `gmail-send` uses `authMode: "required"` (default), which extracts a `userId` from the JWT. Service role JWTs have no user — so `gmail-send` returns 401 and the invoice email silently fails.

The `send_quote` action works because it forwards the logged-in user's auth header. `accept_and_convert` has no user context.

### Issue 2: `sales_quotations` query uses non-existent column
Line 304: `.eq("quote_id", quote_id)` — but `sales_quotations` has no `quote_id` column. The query silently returns null, making `sqCheck` always null. This means status validation, customer name, company, and amount all fall back to the `quotes` table data (which works), but it's fragile and prevents linking to `sales_quotations`.

**Evidence:** The invoice WAS created (`INV-20260002`, status `sent`), but `email_sent` would have been `false` because gmail-send rejected the service-role auth. The function returned success anyway because the email failure is non-blocking.

## Fix

### 1. `supabase/functions/send-quote-email/index.ts` — send invoice email directly via Gmail API

In `accept_and_convert`: instead of calling `gmail-send` (which requires user auth), directly use the Gmail API with a known sender's refresh token from `user_gmail_tokens`:

- Query `user_gmail_tokens` for any available sender (e.g., first row, or a specific company sender)
- Use their refresh token to get an access token (same logic as `getAccessTokenForUser`)
- Call Gmail API directly to send the invoice email
- This bypasses the auth requirement of `gmail-send`

Alternatively (simpler): extract the token refresh logic into a helper, or look up a default sender user_id and pass it explicitly.

**Chosen approach:** Query the first available Gmail sender from `user_gmail_tokens`, refresh their token, and send directly — keeping the existing `gmail-send` function untouched.

### 2. Fix the `sales_quotations` join

Change `.eq("quote_id", quote_id)` to match on `quotation_number` using the quote's `quote_number`:
```
.eq("quotation_number", quoteNumber)
```

### 3. Second acceptance attempt

The second attempt failed with "can no longer be accepted" because the first attempt already changed `quotes.status` to `"accepted"`. This is correct behavior — but the status check should also allow `"accepted"` for the case where the first attempt succeeded at creating the invoice but failed at sending the email (so re-acceptance just re-sends).

Add `"accepted"` to `validStatuses` but check if invoice already exists — if so, just re-send the email instead of creating a duplicate invoice.

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — fix Gmail send auth, fix sales_quotations join, handle re-send on re-accept

