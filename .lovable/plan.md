

# Fix: WooCommerce Webhook 401 Error

## Root Cause
The `wc-webhook` edge function is not listed in `supabase/config.toml` with `verify_jwt = false`. By default, edge functions require a valid JWT. WooCommerce sends no JWT, so the request is rejected with a 401 before your function code even executes.

## Plan

1. **Add `wc-webhook` to `supabase/config.toml`** with `verify_jwt = false` — this is the only change needed.

```toml
[functions.wc-webhook]
verify_jwt = false
```

No other code changes are required. The function already has its own HMAC-SHA256 signature verification, so disabling JWT verification is safe — only requests signed with your `WC_WEBHOOK_SECRET` will be processed.

## After Deployment
Once deployed, go back to the WooCommerce webhook page and click "Save webhook" — WooCommerce will re-ping the delivery URL and should now receive a 200 response.

