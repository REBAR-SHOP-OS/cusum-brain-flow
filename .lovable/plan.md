

## Stripe → QuickBooks Invoice + Payment Integration

### What exists today
- **`stripe-payment`** edge function: Creates payment links, checks status — but NO webhook handler
- **`wc-webhook`** edge function: Full WooCommerce → QB pipeline (signature verify, customer upsert, invoice creation, idempotency via `wc_qb_order_map`)
- **QB utilities**: Token refresh, `qbFetch` with retry/backoff, customer find-or-create — all in `wc-webhook` (duplicated from `qb-sync-engine`)
- **Secrets**: `STRIPE_SECRET_KEY`, `QUICKBOOKS_CLIENT_ID/SECRET`, `QUICKBOOKS_ENVIRONMENT` all configured
- **Missing**: `STRIPE_WEBHOOK_SECRET` — needed for signature verification

### Implementation Plan

#### 1. New secret: `STRIPE_WEBHOOK_SECRET`
Request user to add their Stripe webhook signing secret (`whsec_...`).

#### 2. Database migration — `stripe_qb_sync_map` table
New idempotency/mapping table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `company_id` | UUID NOT NULL | |
| `stripe_payment_intent_id` | TEXT NOT NULL | Unique key |
| `stripe_session_id` | TEXT | Checkout session ID |
| `stripe_customer_id` | TEXT | |
| `customer_email` | TEXT | |
| `qb_customer_id` | TEXT | |
| `qb_invoice_id` | TEXT | |
| `qb_payment_id` | TEXT | |
| `qb_doc_number` | TEXT | |
| `total_amount` | NUMERIC | |
| `currency` | TEXT | |
| `status` | TEXT NOT NULL | pending/synced/error |
| `error_message` | TEXT | |
| `retry_count` | INT DEFAULT 0 | |
| `synced_at` | TIMESTAMPTZ | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

Unique index on `(company_id, stripe_payment_intent_id)`. RLS: service-role write, authenticated SELECT scoped to company.

#### 3. New edge function: `stripe-qb-webhook/index.ts`
Modeled on `wc-webhook` pattern:

- **Signature verification**: HMAC-SHA256 using `STRIPE_WEBHOOK_SECRET` via `Stripe-Signature` header
- **Event filtering**: Only process `checkout.session.completed` and `payment_intent.succeeded` where status is `paid`/`succeeded`
- **Expand line items**: Fetch `checkout.session.line_items` from Stripe API when available
- **Customer upsert**: Reuse same `findOrCreateQBCustomer` logic (extracted to share with `wc-webhook`)
- **Invoice creation**: `DocNumber` = session ID or WC order number from metadata; line items from Stripe line_items or metadata fallback
- **Payment creation**: QB Payment entity linked to the invoice via `LinkedTxn`, deposit account from `qb_company_config` (default "Stripe Clearing")
- **Idempotency**: Check `stripe_qb_sync_map` — skip if `qb_invoice_id` + `qb_payment_id` both exist
- **Error handling**: Retry 429/5xx with backoff, notify via `notifications` table
- **Audit trail**: Log `stripe_qb_invoice_created` and `stripe_qb_payment_created` events

#### 4. Add to `config.toml`
```toml
[functions.stripe-qb-webhook]
verify_jwt = false
```

#### 5. Extract shared QB helpers to `_shared/qbClient.ts`
Move `qbFetch`, `refreshQBToken`, `getCompanyQBConfig`, `findOrCreateQBCustomer` from `wc-webhook` into a shared module. Both `wc-webhook` and `stripe-qb-webhook` import from there. This eliminates ~150 lines of duplication.

#### 6. Admin UI — Stripe→QB settings panel
Add a section to the existing Integrations page or QB settings:
- Display webhook URL for user to paste into Stripe Dashboard
- Input for deposit account name (stored in `qb_company_config`)
- "Test Event" button that calls the edge function with a mock payload
- Sync status table showing recent `stripe_qb_sync_map` entries

### Execution order
1. Request `STRIPE_WEBHOOK_SECRET` secret
2. Run DB migration for `stripe_qb_sync_map`
3. Extract shared QB helpers to `_shared/qbClient.ts`
4. Create `stripe-qb-webhook` edge function
5. Update `wc-webhook` to import from shared helpers
6. Add admin UI panel
7. Deploy and test

