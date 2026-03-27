
Goal: fix the three recurring failures together so one accepted quote reliably becomes one correct invoice with the same items, sends the invoice email once, and includes a real QuickBooks link when QuickBooks returns one.

What I found
1. Invoice items are not being persisted
- `sales_invoice_items.total` is a generated column in the database.
- Current code still inserts `total` in:
  - `supabase/functions/send-quote-email/index.ts`
  - `src/components/accounting/documents/DraftInvoiceEditor.tsx`
- Result: inserts fail or are skipped, and the invoice ends up with no stored line items.
- Evidence: `sales_invoice_items` is currently empty.

2. The accepted invoice is not linked back to its source quotation
- Latest invoice `INV-20260001` exists with `quotation_id = null`.
- Latest quote `QAI-2587` has 2 line items in `quotes.metadata.line_items`.
- Because the invoice is not linked, later fallback logic cannot reliably recover the original quote items.

3. QuickBooks invoice creation is using the wrong item amount shape
- The editor and acceptance flow send QuickBooks items like:
  - `amount = quantity * unitPrice`
  - plus `quantity`
- But `quickbooks-oauth` multiplies again:
  - `Amount = item.amount * quantity`
  - `UnitPrice = item.amount`
- Result: QuickBooks totals can be inflated and mismatch the quotation.

4. Public quote acceptance cannot safely create QuickBooks invoices the same way as logged-in UI
- `accept_and_convert` calls `quickbooks-oauth` using a service-role style internal request.
- `quickbooks-oauth` resolves company context from a logged-in user profile.
- That makes the public acceptance path unreliable for QuickBooks creation, even if the editor path works.

5. Email delivery failures are too silent
- Public invoice send uses direct Gmail and returns success even when `emailOk` is false.
- Manual send catches QuickBooks errors silently and still sends without clearly reporting what failed.
- This is why the flow appears “done” even when the customer never receives the invoice or QB link.

6. Real QuickBooks links are currently absent in mirrored data
- `accounting_mirror` invoice rows currently show `InvoiceLink = null`.
- So the system should not pretend a QB link exists.
- The fix must focus on creating the QB invoice correctly and only showing the link when QuickBooks actually returns one.

Implementation plan

1. Fix invoice-item persistence first
- Remove `total` from every insert into `sales_invoice_items`.
- Let the database compute it automatically.
- Update both:
  - quote acceptance copy logic
  - invoice editor fallback persistence
  - invoice editor save logic

2. Make quote-to-invoice linkage deterministic
- In `send-quote-email/index.ts`, when converting from a quote:
  - always persist enough source linkage to recover the original quote later
  - if no `sales_quotations` row exists, resolve from the `quotes` row directly
  - store the originating quote reference in invoice metadata so item recovery never depends on one missing join
- Then make the invoice editor resolve items in this order:
  1. `sales_invoice_items`
  2. linked source `quotes.metadata.line_items`
  3. `sales_quotation_items`
  4. invoice metadata fallback
  5. single-row amount fallback last

3. Fix QuickBooks line-item mapping
- Standardize the payload so callers send unit price, not line total.
- Update:
  - `DraftInvoiceEditor.tsx`
  - `send-quote-email/index.ts`
- And harden `quickbooks-oauth/index.ts` so it accepts either:
  - `unitPrice + quantity`
  - or legacy `amount + quantity`
- Internally normalize once before building QB lines.

4. Split QuickBooks invoice creation into two safe paths
- Logged-in manual send:
  - keep using `quickbooks-oauth`
  - create QB invoice before email
  - use returned `InvoiceLink` immediately
- Public quote acceptance:
  - do not depend on logged-in user context
  - use a company-scoped QuickBooks helper inside `send-quote-email` or a shared company-based QB utility instead of the user-based handler
  - mirror the created QB invoice immediately

5. Make email sending reliable and visible
- In public acceptance flow:
  - if invoice email send fails, return that failure clearly instead of silent success
  - log the exact Gmail failure path
- In manual editor:
  - distinguish:
    - invoice email sent
    - Stripe link created
    - QuickBooks invoice created
    - QB link available / unavailable
- Do not block sending the invoice email just because QB link is unavailable, but do surface that status clearly.

6. Keep QuickBooks link logic truthful
- Only show the QB payment button when a real `InvoiceLink` exists from:
  1. the fresh QB create-invoice response
  2. mirrored QB invoice data
- No fake fallback URLs.
- If QuickBooks does not return `InvoiceLink`, send the invoice with Stripe only.

Technical details
```text
Primary breakage chain today:
Quote accepted
  -> invoice created with quotation_id null
  -> sales_invoice_items insert includes generated column "total"
  -> no invoice items stored
  -> UI/email fall back inconsistently
  -> QB payload sends line total as unit price
  -> QB invoice total mismatches
  -> public acceptance QB creation depends on user-based auth context
  -> QB link missing
  -> Gmail failure can be hidden
```

Files to update
- `supabase/functions/send-quote-email/index.ts`
  - remove `total` from inserts
  - enforce source quote linkage
  - normalize item copy
  - use company-safe QB creation for public acceptance
  - hard-fail or clearly report invoice email send failure
- `src/components/accounting/documents/DraftInvoiceEditor.tsx`
  - remove `total` from inserts
  - fix item resolution order
  - send normalized QB items
  - improve send-status reporting
- `supabase/functions/quickbooks-oauth/index.ts`
  - normalize legacy/new item shapes
  - build QB lines from unit price correctly
  - keep mirroring full invoice response including `InvoiceLink`

Expected result after fix
- Accepted invoice shows the exact same items as the quote
- Totals stay consistent without double-tax or double-multiplication
- Invoice email actually reports success/failure correctly
- Stripe link appears immediately
- QuickBooks link appears immediately when QuickBooks returns a real `InvoiceLink`, otherwise it is omitted cleanly
