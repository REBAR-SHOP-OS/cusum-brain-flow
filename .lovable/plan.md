

# Remove "Create Invoice" Button from Quotation Cards

## Problem
The "→ Create Invoice" button on quotation cards (in AccountingDocuments) calls a `qb-sync-engine` edge function that is not functional. The user wants it removed.

## Fix
**File: `src/components/accounting/AccountingDocuments.tsx`** (lines 418-430)

Remove the "→ Create Invoice" `Button` block inside the `{isSale && ( ... )}` section. Keep the "Convert to Order" button and all other elements.

Also remove the now-unused state and handler:
- `convertingQuoteId` state (search for its declaration)
- `handleCreateInvoiceFromQuote` function (lines 250-264)
- `FileOutput` from lucide imports if no longer used elsewhere

## Files Changed
- `src/components/accounting/AccountingDocuments.tsx` — remove Create Invoice button, handler, and related state

