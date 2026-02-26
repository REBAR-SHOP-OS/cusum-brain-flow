

# Stripe Integration + Dual Payment Links + Stripe-QB Reconciliation + AI Email Receipt/Invoice Collection

This is a large feature set with four interconnected parts. Here is the full implementation plan.

---

## Part 1: Stripe Integration (Easy Connect)

**No `STRIPE_SECRET_KEY` exists yet** — we need to request it first.

### A. Request secret
- Use the `add_secret` tool to prompt for `STRIPE_SECRET_KEY`

### B. Create `supabase/functions/stripe-payment/index.ts`
Edge function with actions:
- `check-status` — `GET https://api.stripe.com/v1/account` with Bearer token; returns connected/error status
- `create-payment-link` — Creates a one-time Stripe Price via `/v1/prices`, then a Payment Link via `/v1/payment_links` with metadata (invoice_number, customer_name, qb_invoice_id)
- `get-payment-link` — Looks up cached link from `stripe_payment_links` table
- `list-payments` — Queries Stripe charges by metadata for reconciliation

Uses `requireAuth` for all actions. CORS headers included.

### C. Add to `supabase/config.toml`
```toml
[functions.stripe-payment]
verify_jwt = false
```

### D. Update `src/hooks/useIntegrations.ts`
- Add Stripe status check in `checkIntegrationStatus` (calls `stripe-payment` with `action: "check-status"`)
- Add Stripe status check in `checkAllStatuses`
- Add `"stripe"` to the `oauthIntegrations` list in `Integrations.tsx` so clicking it opens the ConnectDialog instead of the manual credential form

### E. Update `integrationsList.ts`
- Remove the `fields` array from Stripe (no longer needs manual credential paste — the secret is stored server-side)

---

## Part 2: Dual Payment Links on Invoices

### A. Database migration: `stripe_payment_links` table
```sql
CREATE TABLE public.stripe_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  qb_invoice_id TEXT NOT NULL,
  invoice_number TEXT,
  customer_name TEXT,
  stripe_price_id TEXT,
  stripe_payment_link_id TEXT,
  stripe_url TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'cad',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.stripe_payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own company links" ON public.stripe_payment_links
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
```

### B. Update `InvoiceEditor.tsx`
- Add a "Payment Links" section after the "Amount Due" block (line ~595), visible only when `amountDue > 0` and in view mode
- Two buttons: "Pay via QuickBooks" and "Pay via Stripe"
- QuickBooks link: constructed from the invoice's `InvoiceLink` field or fallback to `https://app.qbo.intuit.com/app/customerbalance?invoiceId={Id}`
- Stripe link: calls `stripe-payment` edge function with `action: "create-payment-link"`, caches the result
- Copy-to-clipboard button for each link
- Loading spinner while generating Stripe link

### C. Update `AccountingInvoices.tsx`
- Add a small `Link` icon button in the actions column (line ~232) for invoices with balance > 0
- Clicking copies the Stripe payment link (or generates one if none exists)

---

## Part 3: Stripe-QB Reconciliation

### A. Update `supabase/functions/auto-reconcile/index.ts`
- Add a new data source: query `stripe_payment_links` table joined with Stripe payment status
- Call Stripe `/v1/payment_intents?metadata[qb_invoice_id]={id}` to check for completed payments
- When a Stripe payment is found for a QB invoice:
  - Match it against the corresponding `accounting_mirror` Invoice entry
  - If amount matches exactly and payment is `succeeded` → 100% confidence auto-match
  - Otherwise create a `human_task` for review
- Log matched Stripe payments in `reconciliation_matches` with `source: "stripe"`

### B. Create a scheduled sync (optional enhancement)
- The existing `auto-reconcile` function can be triggered on demand or via cron
- No new function needed — just extend the matching logic

---

## Part 4: AI Email Receipt/Invoice Collection

### A. Update `supabase/functions/gmail-webhook/index.ts`
- After the existing email processing logic (which already parses incoming emails), add an AI classification step
- For each incoming email, check if it contains a receipt, invoice, or payment confirmation using Gemini 2.5 Flash
- Detection criteria: attachments with PDF/image, subject lines containing "invoice", "receipt", "payment", "statement", body text with dollar amounts and vendor names

### B. Create processing logic within `gmail-webhook`
- When a receipt/invoice email is detected:
  1. Extract attachments (PDF, images)
  2. Call the existing `ai-document-import` edge function to parse the document
  3. Store the extracted data in `accounting_mirror` or a new `email_collected_documents` table
  4. Create a `human_task` for review: "New receipt from {vendor} for ${amount} detected in email"
  5. If QB is connected, attempt to match against existing QB bills/expenses

### C. Database migration: `email_collected_documents` table
```sql
CREATE TABLE public.email_collected_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  email_id TEXT,
  gmail_message_id TEXT,
  document_type TEXT CHECK (document_type IN ('receipt', 'invoice', 'statement', 'payment_confirmation')),
  vendor_name TEXT,
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'CAD',
  document_date DATE,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  attachment_url TEXT,
  status TEXT DEFAULT 'pending_review',
  qb_entity_id TEXT,
  qb_entity_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_collected_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own company docs" ON public.email_collected_documents
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `supabase/functions/stripe-payment/index.ts` |
| Modify | `supabase/config.toml` — add `[functions.stripe-payment]` |
| Modify | `src/hooks/useIntegrations.ts` — add Stripe status checks |
| Modify | `src/pages/Integrations.tsx` — add "stripe" to ConnectDialog list |
| Modify | `src/components/integrations/integrationsList.ts` — clear Stripe fields |
| Modify | `src/components/accounting/InvoiceEditor.tsx` — add payment links section |
| Modify | `src/components/accounting/AccountingInvoices.tsx` — add payment link action |
| Modify | `supabase/functions/auto-reconcile/index.ts` — add Stripe payment matching |
| Modify | `supabase/functions/gmail-webhook/index.ts` — add receipt/invoice AI detection |
| Create | DB migration for `stripe_payment_links` table |
| Create | DB migration for `email_collected_documents` table |

## Execution Order

1. Request `STRIPE_SECRET_KEY` secret (must wait for user input)
2. Create DB migrations (both tables)
3. Create `stripe-payment` edge function
4. Update integration hooks and UI (Parts 1D, 1E, 2B, 2C)
5. Update `auto-reconcile` for Stripe-QB matching (Part 3)
6. Update `gmail-webhook` for AI receipt collection (Part 4)

