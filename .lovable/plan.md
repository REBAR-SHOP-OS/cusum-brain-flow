

# Fix: Quotation Email Issues

## Issues Identified from the PDF

1. **Valid Until shows raw ISO timestamp**: `2026-04-25T00:00:00+00:00` instead of a formatted date like `Apr 25, 2026`
2. **Subtotal/HST show extra decimal places**: `$94,860.531` and `$12,331.869` — should be rounded to 2 decimals
3. **Email subject encoding broken**: `Ã¢Â€Â"` appears instead of `—` (em dash). The subject line uses a literal em dash character which gets double-encoded through `encodeURIComponent` + `btoa` in `createRawEmail`
4. **Double signature**: The branded email wrapper adds the actor signature, then `gmail-send` fetches and appends the SAME signature again from `email_signatures` table

## Changes

### 1. `supabase/functions/send-quote-email/index.ts`

**Fix Valid Until date formatting** (line 97):
- Replace raw `quote.valid_until` with a formatted date string: `new Date(quote.valid_until).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })`

**Fix decimal rounding** (lines 73-75):
- Use `.toFixed(2)` for subtotal and taxAmount before passing to `toLocaleString`
- Ensure subtotal and taxAmount are rounded: `Math.round(subtotal * 100) / 100`

**Fix subject encoding** (line 117, 260):
- Replace em dash `—` with a plain ASCII `–` or `-` in the subject line to avoid encoding issues:
  ```
  `Quotation ${quoteNumber} - REBAR.SHOP`
  ```

**Fix double signature** (lines 115-119, 255-262):
- When calling `gmail-send`, pass `sent_by_agent: true` or add a flag to tell gmail-send to skip its own signature. However, since we can't easily modify gmail-send's behavior, the simpler fix is to NOT include the signature in `buildBrandedEmail` and let gmail-send handle it. But that would affect other uses.
- Better approach: pass the already-branded HTML directly and include a custom header or flag. Actually the simplest fix: the branded email already has the signature, so we should tell gmail-send to skip its own signature. Since gmail-send always appends `sigRow?.signature_html`, we should instead NOT pass the signature to `buildBrandedEmail` in send-quote-email, and let gmail-send handle it naturally. 
- **Decision**: Remove the signature from `buildBrandedEmail` call in send-quote-email (pass `signatureHtml: undefined, actorName: undefined`) since gmail-send will append the signature itself.

### 2. No other file changes needed

The send-quote-email edge function is the only file that needs fixes. The gmail-send function is working correctly — it's designed to append signatures. The issue is that send-quote-email pre-adds the signature via the branded wrapper.

## Files Changed
- `supabase/functions/send-quote-email/index.ts`

