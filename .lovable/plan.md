

# Fix: Remove Project Name and Scrap Info from Invoice Line Item Descriptions

## Problem
The AI quotation generator creates descriptions like:
- `Rebar Fabrication & Supply – 20 york (incl. 15% scrap)`
- `Delivery — 50 km × 2 trip(s) (round trip)`

These descriptions carry over from the quote into the invoice. QuickBooks items only have the base product name (e.g., "Rebar Fabrication & Supply"), so the descriptions don't match.

## Root Cause
**File:** `supabase/functions/ai-generate-quotation/index.ts` lines 201, 211, 252

The quotation generator appends project-specific details directly into the `description` field:
```
`Rebar Fabrication & Supply – ${project.name} (incl. ${scrapPct}% scrap)`
```

When the quote converts to an invoice, this full string becomes the invoice line item description, which doesn't match the QuickBooks item name.

## Fix
Separate the product name from the project-specific details. Store the clean product name as the `description` and move the project details into a `note` or `detail` sub-field in the line item metadata.

### Changes in `supabase/functions/ai-generate-quotation/index.ts`

**Line 201:** Change from:
```
description: `Rebar Fabrication & Supply – ${project.name} (incl. ${scrapPct}% scrap)`
```
To:
```
description: `Rebar Fabrication & Supply`,
detail: `${project.name} (incl. ${scrapPct}% scrap)`
```

**Line 211:** Same pattern — remove `– ${project.name} (incl. ${scrapPct}% scrap)` from description.

**Line 252:** Change from:
```
description: `Delivery — ${deliveryDistanceKm} km × ${trips} trip(s) (round trip)`
```
To:
```
description: `Delivery`,
detail: `${deliveryDistanceKm} km × ${trips} trip(s) (round trip)`
```

### Changes in `src/components/accounting/documents/DraftQuotationEditor.tsx`
Show the `detail` field as a subtitle below the description in the quotation view so the project context is still visible on quotes.

### Changes in `src/components/accounting/documents/DraftInvoiceEditor.tsx`
When copying items from a quote to an invoice, use only the `description` field (ignoring `detail`). This ensures the invoice description matches the QuickBooks item name exactly.

## Expected Result
- Quotation still shows full context (product name + project details as subtitle)
- Invoice description shows only the clean product name: "Rebar Fabrication & Supply"
- QuickBooks item matching works correctly
- No data loss — project details preserved in the quote metadata

## Files Changed
- `supabase/functions/ai-generate-quotation/index.ts` — split description into `description` + `detail`
- `src/components/accounting/documents/DraftQuotationEditor.tsx` — render `detail` as subtitle
- `src/components/accounting/documents/DraftInvoiceEditor.tsx` — use only `description` when loading from quote items

