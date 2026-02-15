
# Add WooCommerce API Key Authentication

Currently all WooCommerce API calls go through WordPress Basic Auth (username + app password). This works but WooCommerce has its own dedicated consumer key/secret authentication which is more secure and gives granular WooCommerce-specific permissions. The screenshot shows the WooCommerce REST API keys that need to be stored.

## What Changes

1. **Store two new secrets**: `WC_CONSUMER_KEY` and `WC_CONSUMER_SECRET`
2. **Update `WPClient`** to use WooCommerce OAuth/query-param authentication for all `/wc/v3/` endpoints instead of WordPress Basic Auth

## How WooCommerce Auth Works

WooCommerce REST API over HTTPS uses query parameter authentication:
```
https://rebar.shop/wp-json/wc/v3/products?consumer_key=ck_xxx&consumer_secret=cs_xxx
```

This is separate from WordPress credentials and gives WooCommerce-specific access control.

## Files to Edit

### 1. Add Secrets (2 new secrets)

- `WC_CONSUMER_KEY` -- the consumer key starting with `ck_`
- `WC_CONSUMER_SECRET` -- the consumer secret starting with `cs_`

### 2. `supabase/functions/_shared/wpClient.ts`

- Add optional WooCommerce credentials in the constructor: read `WC_CONSUMER_KEY` and `WC_CONSUMER_SECRET` from env
- Modify the `request` method: when the endpoint starts with `/wc/v3/`, use query-param auth (`consumer_key` and `consumer_secret`) instead of Basic Auth header
- Fall back to existing Basic Auth if WC keys are not set (backward compatible)

### Technical Detail

In the `request` method, before making the fetch call:

```text
if endpoint starts with "/wc/v3/" AND WC keys exist:
  - append consumer_key and consumer_secret as URL query params
  - do NOT send Authorization header
else:
  - use existing Basic Auth header (WordPress endpoints)
```

This keeps WordPress post/page operations on Basic Auth while routing all WooCommerce calls through proper WC authentication.

No database changes, no new edge functions, no frontend changes needed.
