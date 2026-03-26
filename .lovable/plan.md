
Goal: make AI Auto quotations use the proven old quotation/invoice pricing flow with your new pricing list, and prevent any new $0 quotations from being created.

What I found
- The immediate failure is upstream, not just in the quote template.
- Recent estimation projects created from your PDF have `total_weight_kg = 0`, `total_cost = 0`, status `draft`.
- The `ai-estimate` logs show: `Extracted 0 items (direct parse)`.
- Because the estimation project has no extracted items, `ai-generate-quotation` creates a quote with:
  - `metadata.line_items = []`
  - `total_amount = 0`
  - customer defaults like “Valued Customer”
- The old deterministic pricing approach already exists and works when real weights/items exist. The broken part is that the new AI import path is still handing it an empty project.

Implementation plan

1. Fix summary-PDF extraction so weights are actually captured
- File: `supabase/functions/ai-estimate/index.ts`
- Strengthen the summary-document branch so “Weight Summary Report / Grand Total / Element wise Summary” PDFs produce extracted items even when there are no individual bar marks.
- Add a deterministic fallback parser for summary tables if the AI returns zero items:
  - detect per-bar-size totals like `10M / 15M / 20M`
  - detect grand total kg/tons
  - create synthetic `SUM-*` items with preserved `weight_kg`
- Result: uploaded summary PDFs create a non-zero estimation project instead of a blank draft.

2. Preserve exact imported weights through calculation
- File: `supabase/functions/ai-estimate/index.ts`
- Keep the current `SUM-` weight preservation, but correct the costing behavior so summary rows retain:
  - exact `weight_kg`
  - valid `line_cost`
  - useful `element_type` / `element_ref`
- Add a guard so if extraction still yields zero weight, the function returns a clear error instead of silently saving an empty project.

3. Replace AI arithmetic in quotation generation with deterministic pricing
- File: `supabase/functions/ai-generate-quotation/index.ts`
- Rework this function to use the old reliable method for totals:
  - read estimation items / total weight
  - apply your pricing config brackets
  - apply scrap %
  - separate cage pricing if applicable
  - add shop drawings using the configured bracket rule
  - add shipping only when distance exists
- Keep AI only for optional wording/notes if needed, not for math.
- This ensures the new price list is applied exactly and totals cannot drift to zero from a weak AI response.

4. Reuse the existing pricing-engine pattern instead of inventing another one
- Files:
  - `supabase/functions/ai-generate-quotation/index.ts`
  - possibly shared logic from `supabase/functions/_shared/quoteCalcEngine.ts`
- Align the AI Auto path with the proven quote-engine style:
  - deterministic line items
  - deterministic subtotal/tax/total
  - assumptions/exclusions stored in metadata
- This is the “learn from old method, apply new price list” part: reuse the old structure, swap in your current pricing config.

5. Block saving $0 quotations
- File: `supabase/functions/ai-generate-quotation/index.ts`
- Before inserting into `quotes`, add hard validation:
  - if no estimation items
  - or total weight is 0
  - or generated line items sum to 0
  → return a clear error like “No measurable rebar was extracted from this file, so no quotation was created.”
- This avoids fake-success messages and bad records like `QAI-2590`.

6. Improve the UI error path so you know why generation failed
- File: `src/components/accounting/GenerateQuotationDialog.tsx`
- Surface backend failure reasons directly in the toast/dialog:
  - “summary PDF could not be parsed”
  - “0 weight extracted”
  - “pricing config missing”
- Optional: show extracted total weight before quote creation when generated from upload.

Technical details
- Root cause chain:
  `PDF summary -> ai-estimate extracts 0 items -> estimation_project saved with 0 weight -> ai-generate-quotation prices empty BOM -> quote saved with 0 total`
- Existing evidence:
  - `ai-estimate` log: `Extracted 0 items`
  - latest project `20`: `total_weight_kg = 0`
  - latest quote `QAI-2590`: `line_items = []`, `total_amount = 0`
- Safest architecture:
  - AI for extraction only
  - deterministic code for pricing math
  - hard guard against zero-value quote creation

Files to change
- `supabase/functions/ai-estimate/index.ts`
- `supabase/functions/ai-generate-quotation/index.ts`
- `supabase/functions/_shared/quoteCalcEngine.ts` (if shared pricing helper extraction is needed)
- `src/components/accounting/GenerateQuotationDialog.tsx`

Validation after implementation
1. Upload the same PDF again
2. Confirm a new estimation project is created with non-zero `total_weight_kg`
3. Confirm the generated quotation contains non-empty line items
4. Confirm total uses your latest pricing brackets and shop drawing rules
5. Confirm no quote is created at all if extracted weight is zero
