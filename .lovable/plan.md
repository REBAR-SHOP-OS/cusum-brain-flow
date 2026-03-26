

# Add Scrap % Control, Extract Info from Estimate & Terms/Conditions

## Changes

### 1. `src/components/accounting/GenerateQuotationDialog.tsx`
- Add `scrapPercent` state (default `"15"`)
- Add a number input for scrap % in the delivery/shop-drawings grid (make it 3-col)
- Pass `scrap_percent` in the body to both `ai-estimate` and `ai-generate-quotation` calls
- Reset `scrapPercent` on dialog close
- Auto-populate `customerName`, `projectName`, `deliveryDistance` from selected estimation project data when available

### 2. `supabase/functions/ai-generate-quotation/index.ts`
- Read `scrap_percent` from request body; use it instead of config default
- Add a `terms` array to quote metadata:
  ```
  ["Prices valid for 30 days from quote date.",
   "Payment terms: Net 30.",
   "Full Terms & Conditions: https://www.crm.rebar.shop/terms"]
  ```
- Store `terms` in metadata and in the `notes` text (appended after exclusions)
- Pass `project.name` into metadata as `project_name` so DraftQuotationEditor can display it

### 3. `src/components/accounting/documents/DraftQuotationEditor.tsx`
- When loading metadata, also read `meta.terms` and store in local state
- Pass `terms` through to the QuotationTemplate preview (already renders `data.terms`)
- Use `data.notes` (from DB column) as the notes source — the backend now writes the full formatted text there, so the existing `resolvedNotes` fallback handles older quotes

## Files Changed
- `src/components/accounting/GenerateQuotationDialog.tsx`
- `supabase/functions/ai-generate-quotation/index.ts`
- `src/components/accounting/documents/DraftQuotationEditor.tsx`

