

# Fix: WooCommerce Webhook Signature Verification Failing

## Root Cause
The logs confirm the function IS being reached (the `verify_jwt = false` config change worked). The 401 now comes from your function's own HMAC-SHA256 signature check at line 356. The WooCommerce "Save webhook" ping is arriving but failing signature validation.

This is likely caused by an encoding mismatch: WooCommerce delivers `x-wc-webhook-signature` as a **base64-encoded HMAC-SHA256** hash, but there may be subtle differences in how the hash is computed or compared (e.g., padding, character encoding).

## Plan

1. **Add debug logging** to the `wc-webhook` function to compare the received vs computed signature on the next ping attempt. This will confirm whether it's a secret mismatch or encoding issue.

2. **Use constant-time comparison** (currently using `===`) to prevent timing attacks and handle potential padding differences.

3. **Handle the WooCommerce ping topic gracefully** — WooCommerce sends a small `{"webhook_id": N}` payload on save. The function should accept this and return 200 immediately after signature verification passes.

### Changes to `supabase/functions/wc-webhook/index.ts`

**A. Add debug logging in the signature check block (around lines 345-362):**
- Log whether the `x-wc-webhook-signature` header is present
- Log the first 10 characters of the computed vs received signature (safe for debugging, not enough to reconstruct)
- Log the `x-wc-webhook-topic` header to identify ping vs order events

**B. Add ping handler before order processing (after line 362):**
- Check `x-wc-webhook-topic` header for `action.wc_webhook_ping`
- If it's a ping, return `200 OK` immediately (no order processing needed)

**C. Improve signature comparison to handle edge cases:**
- Trim whitespace from both signatures before comparing
- Use a constant-time comparison function

### Technical Detail
The modified signature verification block will look like:

```typescript
const wcSignature = req.headers.get("x-wc-webhook-signature");
const wcTopic = req.headers.get("x-wc-webhook-topic");
const wcWebhookSecret = Deno.env.get("WC_WEBHOOK_SECRET");

console.log(`[wc-webhook] Topic: ${wcTopic}, Signature present: ${!!wcSignature}, Secret present: ${!!wcWebhookSecret}`);

if (!wcWebhookSecret) { ... }

if (!wcSignature) {
  console.warn("[wc-webhook] Missing x-wc-webhook-signature header");
  return 401;
}

const valid = await verifyWCSignature(rawBody, wcSignature.trim(), wcWebhookSecret.trim());
console.log(`[wc-webhook] Signature valid: ${valid}`);

if (!valid) {
  return 401;
}

// Handle ping
if (wcTopic === "action.wc_webhook_ping") {
  return 200 { webhook_id: ..., ok: true };
}
```

This will let us see exactly why the signature is failing on the next attempt. If it turns out the stored secret doesn't match, we'll update it.

