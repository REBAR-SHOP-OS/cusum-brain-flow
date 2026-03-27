

# Fix: Invoice Line Items Not Matching Quotation After Conversion

## Root Cause

The entire quotation system has a **data split** problem:

1. **DraftQuotationEditor** saves line items ONLY to `quotes.metadata.line_items` (JSON blob) — never to `sales_quotation_items` table
2. **ai-generate-quotation** also saves ONLY to `quotes.metadata.line_items`
3. **accept_and_convert** first checks `sales_quotation_items` (empty), falls back to `metadata.line_items` — but the metadata items use `unitPrice` (camelCase) while the fallback code looks for `unit_price` first
4. When the metadata fallback insert silently fails or produces wrong values, the **DraftInvoiceEditor** falls to its last resort: a single "Invoice total" line from the header amount

The fix: ensure items are **always persisted** to `sales_quotation_items` when saving a quotation, so the conversion path reliably copies structured items.

## Changes

### 1. `src/components/accounting/documents/DraftQuotationEditor.tsx` — Persist items to `sales_quotation_items` on save

In `handleSave`, after updating the `quotes` record, also upsert line items into `sales_quotation_items`:
- Delete existing items for this quote
- Insert current items with proper `unit_price`, `quantity`, `total`, `sort_order`
- This requires knowing the `sales_quotations` record linked to this quote, OR creating one if it doesn't exist

**Simpler approach**: Since `accept_and_convert` reads from `quotes.metadata.line_items`, fix the metadata field mapping in the fallback to handle both `unitPrice` and `unit_price` correctly — AND ensure the fallback actually inserts to `sales_invoice_items`.

### 2. `supabase/functions/send-quote-email/index.ts` — Fix metadata field mapping in accept_and_convert

The metadata fallback (lines 518-531) already handles `mi.unit_price || mi.unitPrice` but the issue is subtler: the DraftQuotationEditor saves items as `{ description, quantity, unitPrice }` (no `unit_price` key). The fallback code at line 527 does `mi.unit_price || mi.unitPrice` — this works. But the `total` calculation uses `(mi.quantity || 1) * (mi.unit_price || mi.unitPrice || 0)` which should also work.

The REAL issue: when `sqCheck?.id` exists (a matching `sales_quotations` record), the code enters the `if (sqCheck?.id)` block at line 495, queries `sales_quotation_items`, finds 0 rows, and exits the if-block. Then line 517 checks if there are already invoice items — there aren't. So it falls through to the metadata fallback. But `meta` at this point is from the `quotes` table (line 141), which has `line_items`. This should work...

**Unless `sqCheck?.id` doesn't match** — if there's no `sales_quotations` record with the same `quotation_number`, then `sqCheck` is null, and the code skips the item copy entirely, going straight to the metadata fallback. Let me verify this.

Actually, the simplest fix: make the **DraftQuotationEditor save items to the `sales_quotation_items` table** in addition to metadata, by first ensuring a `sales_quotations` record exists for each `quotes` record.

### Revised approach — Fix the conversion to always use `quotes.metadata.line_items`

Since ALL quotations store items in `quotes.metadata.line_items`, the conversion should always use that as the primary source (not `sales_quotation_items`). The `sales_quotation_items` table is secondary.

### File: `supabase/functions/send-quote-email/index.ts`

In the `accept_and_convert` section (after invoice creation), change the item copy logic:
1. **Primary source**: `quotes.metadata.line_items` (from the `quote` variable, already loaded)
2. **Secondary source**: `sales_quotation_items` via `sqCheck?.id` (if exists)
3. Always insert into `sales_invoice_items` from whichever source has items
4. Handle both `unitPrice` and `unit_price` field naming

### File: `src/components/accounting/documents/DraftInvoiceEditor.tsx`

In the load logic, when falling back to metadata:
- Also check the linked quotation's `quotes.metadata.line_items` via `quotation_id`
- The current fallback only checks `sales_quotation_items` then `invoice.metadata` — but the invoice metadata doesn't have line items (they're in the `quotes` table)

Add: if no `sales_invoice_items` and no `sales_quotation_items` found, fetch the source `quotes` record via the invoice's `quotation_id` and parse `metadata.line_items`.

## Files Changed
- `supabase/functions/send-quote-email/index.ts` — prioritize `quotes.metadata.line_items` as primary source for item copy during conversion
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — add fallback to fetch items from source `quotes.metadata.line_items`

