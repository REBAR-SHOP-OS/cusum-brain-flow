

# Remove "Accept Online" Link Section from Quotation Views

## Problem
The "To accept this quotation online, visit:" section with the acceptance link is displayed in both the Draft Quotation Editor and the Quotation Template. User wants it permanently hidden.

## Fix — 2 files

### 1. `src/components/accounting/documents/DraftQuotationEditor.tsx`
Remove or comment out the "Accept Online Link" block (~lines 806-817).

### 2. `src/components/accounting/documents/QuotationTemplate.tsx`
Remove or comment out the conditional acceptance link block (~lines 162-172).

## Scope
- 2 files, UI-only removal
- No database changes
- No logic changes — the `/accept-quote/:id` route still works if accessed directly

