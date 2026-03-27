

# Comprehensive Audit: Quotation → Invoice → Payment Links Flow

## Critical Bugs Found

### BUG 1: `convert_to_invoice` action does NOT copy line items to `sales_invoice_items`
**File:** `send-quote-email/index.ts` lines 252-394
**Severity:** CRITICAL

The `convert_to_invoice` action (triggered from the manual editor "Convert to Invoice" button) creates the invoice header but **never copies line items** to `sales_invoice_items`. Compare with `accept_and_convert` (line 494-549) which does copy items. The email sent also uses the raw `lineItemsTable` built from metadata at the top (line 166), which works — but the invoice has no stored items, so when opened in `DraftInvoiceEditor` it must fall back through the resolution chain.

**Fix:** Add the same line-item copy block from `accept_and_convert` into `convert_to_invoice`.

---

### BUG 2: `convert_to_invoice` looks up `sales_quotations` by wrong key
**File:** `send-quote-email/index.ts` line 259
**Severity:** HIGH

It queries `sales_quotations.quote_id = quote_id` but `accept_and_convert` queries `sales_quotations.quotation_number = quoteNumber` (line 403). If `quote_id` is not stored in `sales_quotations.quote_id`, the lookup returns null and: `quotation_id` is set to null, customer info falls back to metadata, and the invoice is orphaned.

**Fix:** Align the lookup — try both `quote_id` and `quotation_number`.

---

### BUG 3: `convert_to_invoice` does NOT push to QuickBooks
**File:** `send-quote-email/index.ts` lines 252-394
**Severity:** HIGH

Unlike `accept_and_convert` (which has a QB push block at lines 577-645), the `convert_to_invoice` action creates no QB invoice. So invoices created via manual conversion never get a QB payment link.

**Fix:** Add the same company-scoped QB push logic from `accept_and_convert`.

---

### BUG 4: `convert_to_invoice` shows pre-tax amount as "Amount Due" but Stripe gets the same pre-tax amount
**File:** `send-quote-email/index.ts` lines 263, 311-313, 344
**Severity:** MEDIUM

`amount = sq?.amount || totalAmount` — this is the tax-inclusive total from the quotation. But the email header says "Amount Due: $X" and the Stripe link is created with the same amount. Compare with `accept_and_convert` where `amount` is explicitly divided by tax rate (line 424) to store the pre-tax subtotal, while `rawTotalWithTax` is used for Stripe. In `convert_to_invoice`, there's no such distinction — the tax treatment is inconsistent.

**Fix:** Standardize: store pre-tax subtotal in invoice, use tax-inclusive total for Stripe and email display.

---

### BUG 5: Tax calculation error in `accept_and_convert` email
**File:** `send-quote-email/index.ts` line 686
**Severity:** HIGH

```typescript
const itemTax = Math.round(itemSubtotal * itemTaxRate) / 100;
```
This computes `subtotal * 13 / 100` which is correct mathematically BUT only if `itemTaxRate` is the raw percentage (13). The variable is set from `meta.tax_rate ?? 13` which IS the raw percentage. So `itemTax = Math.round(subtotal * 13) / 100`. This is actually correct.

Wait — re-reading: `Math.round(itemSubtotal * itemTaxRate) / 100`. If subtotal = 94,858.96 and taxRate = 13:
- `94858.96 * 13 = 1233166.48`
- `Math.round(1233166.48) = 1233166`
- `/ 100 = 12331.66`

This gives the correct tax. ✓ (False alarm on this one.)

---

### BUG 6: `accept_and_convert` stores pre-tax subtotal but email shows inconsistent amounts
**File:** `send-quote-email/index.ts` lines 420-424, 481, 562, 762
**Severity:** MEDIUM

The invoice is created with `amount = rawTotalWithTax / (1 + taxRate)` (pre-tax subtotal). But the Stripe link uses `rawTotalWithTax` (tax-inclusive). The email "Amount Due" shows `emailAmountDue` which gets recalculated from structured items. If structured items unit_prices are already pre-tax, this recalculation produces a different total than the original quotation. The invoice `amount` field is pre-tax but the customer sees tax-inclusive in the email — this is correct behavior, but the invoice DB record will look wrong when opened in the editor (shows pre-tax as the amount).

**Fix:** Store the tax-inclusive total in the invoice record, let the editor handle tax display.

---

### BUG 7: QB customer name lookup uses unsafe string interpolation
**File:** `quickbooks-oauth/index.ts` line 1259
**Severity:** MEDIUM (injection risk)

```typescript
`select * from Customer where DisplayName = '${customerName.replace(/'/g, "\\'")}'`
```
The `\\'` escape is not the correct QB query escape. QB uses `''` (double single-quote). A customer name with `'` will cause a QB query error, failing customer lookup and ultimately failing invoice creation with "Customer ID and line items are required".

**Fix:** Use `customerName.replace(/'/g, "''")` for QB query escaping.

---

### BUG 8: Re-acceptance path doesn't re-fetch line items for email
**File:** `send-quote-email/index.ts` lines 438-453
**Severity:** LOW

When re-accepting (existing invoice found), the code only fetches the Stripe URL. The email still uses `lineItemsTable` from metadata. This should work since metadata is always present — but if metadata was modified after first acceptance, the email shows stale items. The structured items rebuild block (lines 661-716) runs for BOTH paths, so this is actually handled. ✓

---

### BUG 9: `DraftInvoiceEditor` quotation lookup chain is fragile
**File:** `DraftInvoiceEditor.tsx` lines 137-215
**Severity:** MEDIUM

The fallback chain queries `sales_quotations` by `quotation_id`, then gets `quotation_number`, then queries `quotes` by `quote_number`. This breaks when:
- `quotation_id` is null (BUG 2 causes this)
- `quotation_number` doesn't match `quote_number` in `quotes` table
- The quote was created directly in `quotes` without a `sales_quotations` record

**Fix:** Also try matching by `quotes.id` directly if the invoice has a stored `quote_id` in metadata.

---

### BUG 10: `convert_to_invoice` only has Stripe button, no QB button in email
**File:** `send-quote-email/index.ts` lines 331-336
**Severity:** MEDIUM

The `convert_to_invoice` email only has a single Stripe "Pay Now" button. The `accept_and_convert` path has dual payment buttons (Stripe + QB). Manual conversion emails lack the QB option.

**Fix:** Add dual payment buttons matching `accept_and_convert` pattern.

---

### BUG 11: `DraftInvoiceEditor` send email doesn't save items first
**File:** `DraftInvoiceEditor.tsx` lines 360-528
**Severity:** MEDIUM

`handleSendEmail` generates the email from in-memory `items` state and sends it. But it does NOT call `handleSave` first. If the user edited items but didn't click Save, the email will show the edited items but the database still has the old items. Next time the invoice is opened, old items load.

**Fix:** Auto-save before sending email.

---

## Summary of Required Fixes (Priority Order)

1. **`convert_to_invoice`: Copy line items to `sales_invoice_items`** — Items won't appear in invoice editor
2. **`convert_to_invoice`: Fix `sales_quotations` lookup** — Use both `quote_id` and `quotation_number`
3. **`convert_to_invoice`: Add QB invoice push** — No QB payment link for manual conversions
4. **QB customer name escaping** — Single quotes in names break QB lookup
5. **`convert_to_invoice`: Add dual payment buttons** — Only Stripe shown
6. **Tax-inclusive amount handling** — Standardize what's stored vs displayed
7. **`DraftInvoiceEditor`: Auto-save before email send** — Stale data risk
8. **`DraftInvoiceEditor`: Improve quotation lookup fallback** — Handle orphaned invoices

## Files to Change
- `supabase/functions/send-quote-email/index.ts` — Bugs 1, 2, 3, 5, 6, 10
- `supabase/functions/quickbooks-oauth/index.ts` — Bug 7
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — Bugs 9, 11

