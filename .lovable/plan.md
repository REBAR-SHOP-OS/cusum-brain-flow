

# Store WC_WEBHOOK_SECRET and Finalize Webhook Setup

## What's Happening
You've provided the WooCommerce webhook secret: `Q0x9dwu4kXMdh5lQeRkjmAmbOrtFg9E9`

## Plan

1. **Store the secret** using the secrets tool so the `wc-webhook` edge function can verify incoming webhook signatures from rebar.shop
2. **Verify the `wc-webhook` edge function** is deployed and references `WC_WEBHOOK_SECRET` correctly (already implemented in previous messages)

## After This
- Create two webhooks in WooCommerce admin (rebar.shop → WooCommerce → Settings → Advanced → Webhooks):
  - **Webhook 1**: Topic = `Order created`, Delivery URL = `https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/wc-webhook`, Secret = the value above, Status = Active
  - **Webhook 2**: Topic = `Order updated`, same Delivery URL and Secret
- Place a test order to verify the full flow

