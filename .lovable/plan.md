

## Stripe → QuickBooks Invoice + Payment Integration

### Step 1: Add `STRIPE_WEBHOOK_SECRET`
Request the secret from you using the add_secret tool. You typed `whsec_` — I'll prompt you for the full value.

### Step 2: Database migration — `stripe_qb_sync_map`
Create table with: `id` (UUID PK), `company_id` (UUID NOT NULL), `stripe_payment_intent_id` (TEXT NOT NULL), `stripe_session_id` (TEXT), `stripe_customer_id` (TEXT), `customer_email` (TEXT), `qb_customer_id` (TEXT), `qb_invoice_id` (TEXT), `qb_payment_id` (TEXT), `qb_doc_number` (TEXT), `total_amount` (NUMERIC), `currency` (TEXT DEFAULT 'CAD'), `status` (TEXT NOT NULL DEFAULT 'pending'), `error_message` (TEXT), `retry_count` (INT DEFAULT 0), `synced_at` (TIMESTAMPTZ), `created_at`/`updated_at` (TIMESTAMPTZ).

Unique index on `(company_id, stripe_payment_intent_id)`. RLS: enable RLS, allow authenticated SELECT where `company_id` matches user's company via profiles lookup.

### Step 3: Extract shared helpers → `_shared/qbClient.ts`
Move from `wc-webhook/index.ts` lines 39-249 into `supabase/functions/_shared/qbClient.ts`:
- `QBConfig` interface + `RefreshContext` interface
- `refreshQBToken()` — token refresh with DB persistence
- `qbFetch()` — authenticated fetch with retry, backoff, 401 refresh
- `getCompanyQBConfig()` — find QB connection by company
- `findOrCreateQBCustomer()` — email-based customer upsert

Constants `QUICKBOOKS_TOKEN_URL`, `QUICKBOOKS_API_BASE`, `DEFAULT_COMPANY_ID` also move to shared.

### Step 4: Update `wc-webhook/index.ts`
Replace lines 39-249 with imports from `../_shared/qbClient.ts`. Keep WC-specific code (signature verify, `buildInvoicePayload`, main handler).

### Step 5: Create `stripe-qb-webhook/index.ts`
~400 lines:
- **Stripe signature verification**: Parse `Stripe-Signature` header (`t=timestamp,v1=sig`), HMAC-SHA256 using `crypto.subtle`, compare with `constantTimeEqual`, reject if timestamp > 5 min old
- **Event routing**: `checkout.session.completed` (primary) and `payment_intent.succeeded` (fallback)
- **Line items**: Fetch `GET https://api.stripe.com/v1/checkout/sessions/{id}/line_items` using `STRIPE_SECRET_KEY`
- **Customer upsert**: Call shared `findOrCreateQBCustomer` — adapt for Stripe data shape (email, name from session `customer_details`)
- **Invoice creation**: `DocNumber` = session ID or WC order from metadata, line items from Stripe, shipping/discount lines
- **Payment creation**: QB Payment linked to invoice via `LinkedTxn`, deposit account from `qb_company_config.config->>'stripe_deposit_account'` (default "Stripe Clearing")
- **Idempotency**: Check `stripe_qb_sync_map` — skip if `qb_invoice_id` + `qb_payment_id` both exist
- **Error handling**: Retry 429/5xx, insert notification on failure (using `user_id` from profiles, `description` field — matching `notifications` table schema)
- **Audit trail**: `writeEvent()` for `stripe_qb_invoice_created` and `stripe_qb_payment_created`

Note: `findOrCreateQBCustomer` currently expects a WooCommerce order shape. For Stripe, I'll add an overloaded version that accepts `{ email, name, phone }` directly, so both `wc-webhook` and `stripe-qb-webhook` can use it.

### Step 6: Register in `config.toml`
```toml
[functions.stripe-qb-webhook]
verify_jwt = false
```

### Step 7: Admin UI — Stripe→QB sync panel
Add to the Integrations page or as a sub-section:
- Webhook URL display: `https://rzqonxnowjrtbueauziu.supabase.co/functions/v1/stripe-qb-webhook` (copy button)
- Deposit account input (stored in `qb_company_config.config`)
- Recent sync status table from `stripe_qb_sync_map` (last 20 entries)

### Notifications table compatibility
The `notifications` table has NO `company_id` column and uses `description` not `message`. Error notifications will be inserted with `user_id` (looked up from profiles) and `description` for the error text.

