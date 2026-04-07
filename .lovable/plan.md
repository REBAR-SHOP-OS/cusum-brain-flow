
Goal: fix the accepted-quote flow so the created invoice always carries both payment links, and make that invoice visible in the invoices UI the user is checking.

What is happening now
- The public `accept_and_convert` flow already creates a `sales_invoices` row and tries to generate:
  - Stripe payment link
  - QuickBooks payment link
  - invoice PDF
- But the Sales quotations page is using `AccountingDocuments`, and its Invoice tab only renders `data.invoices` from `useQuickBooksData()` — meaning QuickBooks/mirror invoices only.
- The newly created ERP invoice lives in `sales_invoices`, so if QuickBooks sync/mirror is delayed or missing, the invoice does exist but does not appear there.
- Payment links/PDF are generated for the email, but they are not being persisted onto the invoice record metadata for later UI recovery.

Implementation plan

1. Persist payment artifacts on the created invoice
- Update `supabase/functions/send-quote-email/index.ts` in `accept_and_convert` so after Stripe/QB/PDF generation it updates the created `sales_invoices` row metadata with:
  - `stripe_payment_link`
  - `qb_invoice_link`
  - `invoice_pdf_url`
  - optionally `qb_invoice_id` if available later
- Keep existing email behavior, but make the invoice record itself the source of truth too.

2. Preserve both payment links explicitly
- Keep the current dual-link generation flow.
- Tighten the returned/persisted values so both QuickBooks and Stripe links are stored independently, not just used transiently in email HTML.
- If one link fails, do not block invoice creation; store whichever links succeeded.

3. Make converted invoices visible in the Sales/Accounting document tabs
- Update `src/components/accounting/AccountingDocuments.tsx` to also read local ERP invoices from `sales_invoices` via `useSalesInvoices()`.
- For `activeDoc === "invoice"`:
  - merge/render local `sales_invoices` entries alongside `data.invoices`
  - prioritize local invoices when QuickBooks data is empty
  - remove the misleading “Sync from QuickBooks first” empty state when local invoices exist
- Add explicit “View” behavior for local invoices by opening `DraftInvoiceEditor`, since they are ERP-native records, not QuickBooks-native invoice objects.

4. Use stored artifacts when viewing/sending invoices later
- Ensure the invoice editor/view path can reuse persisted metadata links/PDF if present.
- This avoids relying only on live regeneration or mirror lookup after public quote acceptance.

5. Keep the change minimal and safe
- No database schema changes needed.
- No change to quotation acceptance permissions or customer flow.
- Only unify data visibility and persistence so:
  - accepted quote → converted invoice appears in invoices list
  - invoice retains both payment links
  - PDF remains available after conversion

Expected result after fix
- Customer accepts quote
- Invoice is created
- Stripe and QuickBooks payment links are both attempted
- PDF is generated
- All successful artifacts are saved onto the invoice record
- The invoice becomes visible in the invoice tab even before QuickBooks mirror/sync catches up
- Opening the invoice shows a consistent ERP invoice path instead of appearing “missing”

Technical details
- Files to update:
  - `supabase/functions/send-quote-email/index.ts`
  - `src/components/accounting/AccountingDocuments.tsx`
- Likely supporting import:
  - `useSalesInvoices`
  - `DraftInvoiceEditor`
- No backend schema migration required.
