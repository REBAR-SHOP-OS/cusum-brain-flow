

## Stripe → QuickBooks Invoice + Payment Integration

### Implementation Steps

#### Step 1: Request `STRIPE_WEBHOOK_SECRET`
You'll need the webhook signing secret (`whsec_...`) from Stripe Dashboard when you add the new endpoint. I'll prompt you for it.

#### Step 2: Database migration — `stripe_qb_sync_map`
Create the idempotency table with columns for `stripe_payment_intent_id`, `stripe_session_id`, `customer_email`, `qb_invoice_id`, `qb_payment_id`, `qb_doc_number`, `total_amount`, `currency`, `status`, `error_message`, `retry_count`, timestamps. Unique constraint on `(company_id, stripe_payment_intent_id)`. RLS: authenticated SELECT scoped to company.

#### Step 3: Extract shared QB helpers → `_shared/qbClient.ts`
Move from `wc-webhook` into shared module:
- `refreshQBToken` / `qbFetch` (with retry, backoff, 401 refresh)
- `getCompanyQBConfig` (find QB connection by company)
- `findOrCreateQBCustomer` (email-based upsert)

Update `wc-webhook` to import from `_shared/qbClient.ts`.

#### Step 4: Create `stripe-qb-webhook/index.ts`
- **Stripe signature verification** using `STRIPE_WEBHOOK_SECRET` and `Stripe-Signature` header (HMAC-SHA256 with `t=...` timestamp splitting)
- **Event filtering**: `checkout.session.completed` + `payment_intent.succeeded`, only when `payment_status === "paid"` or `status === "succeeded"`
- **Expand line items**: Fetch `GET /v1/checkout/sessions/{id}/line_items` from Stripe API
- **Customer upsert**: Call shared `findOrCreateQBCustomer` using `customer_email` from session
- **Invoice creation**: `DocNumber` = session ID (or WC order number from metadata), line items from Stripe or metadata fallback, shipping/discount lines
- **Payment creation**: QB Payment linked to invoice via `LinkedTxn`, deposit account from `qb_company_config` (default "Stripe Clearing")
- **Idempotency**: Check `stripe_qb_sync_map` — skip if both `qb_invoice_id` and `qb_payment_id` exist
- **Error handling**: Retry 429/5xx, notify via `notifications` table
- **Audit trail**: Log `stripe_qb_invoice_created` and `stripe_qb_payment_created` events

#### Step 5: Register in `config.toml`
```
[functions.stripe-qb-webhook]
verify_jwt = false
```

#### Step 6: Admin UI panel
Section on Integrations or QB settings page:
- Webhook URL display (copy-paste for Stripe Dashboard)
- Deposit account name input
- Recent sync status table from `stripe_qb_sync_map`

### Webhook Setup (for your Stripe Dashboard)
After deployment, you'll add a **second** webhook endpoint in Stripe:
```
URL: https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/stripe-qb-webhook
Events: checkout.session.completed, payment_intent.succeeded
```
Your existing WooCommerce webhook (`rebar.shop/?wc-api=wc_stripe`) stays untouched.

### Technical Details
- Reuses `qbHttp.ts` utilities (fetchWithTimeout, backoffWithJitter, constantTimeEqual)
- Same `DEFAULT_COMPANY_ID` pattern as `wc-webhook` (single-tenant)
- Stripe signature uses `crypto.subtle` HMAC-SHA256 with the `t=timestamp,v1=signature` format
- ~400 lines for the new edge function, ~200 lines extracted to shared module

