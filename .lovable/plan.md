
Goal: make AI Auto quotation generation succeed for weight-summary PDFs like `20.pdf` by fixing the root extraction path, not just the UI error toast.

What I found
- The failure is real and reproducible in the backend:
  - recent `estimation_projects` for file `20.pdf` all saved with `total_weight_kg = 0`
  - `ai-estimate` logs show the AI returns JSON items with `bar_size: null`, `quantity: null`, `cut_length_mm: null`
  - one run even inserted/attempted useless rows and still completed with zero totals
- The frontend message is just the last guard:
  - `GenerateQuotationDialog.tsx` throws `"No rebar data could be extracted..."` when `estData.summary.total_weight_kg <= 0`
- The current rescue logic is not strong enough:
  - `parseWeightSummaryFallback()` only parses the AI response text, not the actual extracted PDF text
  - `rescueAIItems()` only works if AI already gave valid `bar_size` + `weight_kg`, which it did not
  - rows with missing `bar_size` still pass too far through the pipeline and produce zero-weight projects

Plan

1. Strengthen `ai-estimate` fallback hierarchy
- Keep AI extraction as the first attempt
- Add a stricter “useful extraction” test:
  - require at least one item with valid `bar_size`
  - and either positive `weight_kg` or positive `cut_length_mm`
- If the AI response fails that test, discard it entirely and switch to deterministic summary extraction

2. Make deterministic summary extraction work from the real document signal
- Expand `parseWeightSummaryFallback()` to support the actual summary formats seen in weight-summary reports:
  - bar-size totals like `10M 261.74`, `15M 18,657.43`, `20M 25,858.14`
  - grand totals like `Grand Total 44,777 kg`
  - common summary labels like `Weight Summary Report`, `Element wise Summary`
- Use multiple text sources for fallback in order:
  - AI response text
  - filename/context prompt text
  - any fetched plain-text content when available
- If bar-size totals are found, create synthetic `SUM-TOT-*` items directly

3. Harden item sanitation before calculation
- Normalize every extracted item before `calculateItem()`:
  - coerce `quantity`, `cut_length_mm`, `weight_kg`
  - default hooks/laps safely
  - drop items with missing `bar_size` unless they have enough data to be converted into a summary item
- This prevents null/garbage items from influencing summary totals

4. Prevent zero-weight projects from being persisted as “successful”
- In `ai-estimate`, add a final backend guard before inserting the project:
  - if `summary.total_weight_kg <= 0`, return a structured extraction error instead of inserting a completed zero-weight project
- This keeps bad estimation projects out of the database and gives the upload flow a real backend failure instead of a misleading “completed but zero” state

5. Improve the upload flow error handling
- In `GenerateQuotationDialog.tsx`, preserve the current user-facing error, but prefer backend-provided extraction failure messages when available
- This will show a more accurate reason if extraction failed upstream

Expected result
- Weight summary PDFs produce synthetic summary items with non-zero tonnage
- `estimation_projects.total_weight_kg` is non-zero for valid summary reports
- quotation generation proceeds and uses the existing pricing rules, delivery, and shop drawing options
- invalid/empty AI responses no longer create misleading zero-value estimation projects

Technical details
```text
Current failing path:
PDF -> AI returns null-filled JSON -> rescue logic too weak -> zero-weight items/project -> UI blocks quote

Planned fixed path:
PDF -> AI attempt
   -> if useful: calculate normally
   -> if useless: deterministic summary parser builds SUM items
   -> if still zero: return extraction error and do not save project
```

Files to update
- `supabase/functions/ai-estimate/index.ts`
- `src/components/accounting/GenerateQuotationDialog.tsx`

Validation after implementation
- Upload the same `20.pdf`
- Confirm `ai-estimate` returns non-zero `summary.total_weight_kg`
- Confirm a new estimation project is saved with non-zero weight
- Confirm `ai-generate-quotation` creates a quotation with non-zero total
- Confirm delivery and shop drawings appear when selected
