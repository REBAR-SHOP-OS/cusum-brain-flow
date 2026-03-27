
Goal: stop the repeated “No rebar data could be extracted…” failure for the AI quotation upload flow, especially when users upload a mixed XLSX + PDF bundle like `20 york.xlsx` + `20.pdf`.

What I found
- The toast is coming from `src/components/accounting/GenerateQuotationDialog.tsx` after `ai-estimate` returns `summary.total_weight_kg <= 0` (lines 236-239).
- The backend is still creating zero-weight estimation projects:
  - latest `estimation_projects` include multiple `20 york` rows with `total_weight_kg = 0`
  - earlier `20` runs succeeded around `51,494 kg`, so this is a regression/path issue, not missing pricing.
- In `supabase/functions/ai-estimate/index.ts`, `.xlsx/.xls` files are currently sent to the model as base64 `image_url` binary blobs. That is not a reliable spreadsheet extraction path.
- The project already has a proven spreadsheet parser pattern in `src/components/office/OrderCalcView.tsx`, and the backend already uses `npm:xlsx` successfully in other edge functions.
- `ai-estimate` only blocks persistence when `summary.total_weight_kg <= 0 AND extractedItems.length > 0`. If extraction returns no usable items, it still saves a zero-weight project, which then triggers the frontend toast.

Root cause
1. XLSX files are accepted in the UI but not actually parsed deterministically in `ai-estimate`.
2. Mixed uploads let the broken XLSX path poison the extraction result.
3. Zero-result runs are still persisted instead of failing fast with a clear backend error.

Implementation plan
1. Add deterministic spreadsheet parsing to `ai-estimate`
- Import `npm:xlsx@0.18.5`
- For `.xlsx/.xls/.csv`, fetch file bytes/text and parse rows directly before calling the model
- Reuse the existing row-detection/bar-size normalization approach from `OrderCalcView` so spreadsheet uploads produce real `EstimationItemInput[]`

2. Separate extraction by file type
- Spreadsheet files: deterministic parser first
- PDF/images: keep AI extraction path
- Merge both result sets when both file types are uploaded
- Do not send raw XLSX binary to the model anymore

3. Strengthen fallback/rescue logic
- If spreadsheet parsing succeeds, prefer those rows instead of relying on AI
- Keep weight-summary PDF fallback for aggregated reports
- Add a final merged “has usable item” check based on valid `bar_size` plus positive `weight_kg` or `cut_length_mm`

4. Fail fast instead of saving bad projects
- If merged extraction still yields no usable items or computed total weight is zero, return `extraction_failed: true` and do not insert `estimation_projects`
- Close the current loophole where empty extraction persists a zero-weight draft project

5. Improve user-facing error specificity
- If only spreadsheets were uploaded and parsing fails, return a spreadsheet-specific message
- If mixed files were uploaded, mention which file types failed to extract
- Keep the frontend toast, but let it surface the backend’s specific error instead of the generic fallback

Files to update
- `supabase/functions/ai-estimate/index.ts`
- `src/components/accounting/GenerateQuotationDialog.tsx`

Validation after implementation
- Upload `20 york.xlsx` alone → should either extract real items or return a spreadsheet-specific error
- Upload `20.pdf` alone → should still produce non-zero weight via AI/fallback path
- Upload `20 york.xlsx` + `20.pdf` together → should produce a non-zero estimation summary
- Confirm no new `estimation_projects` rows are saved with `total_weight_kg = 0` for failed runs
- Confirm quotation generation proceeds successfully from the new estimation result

Technical notes
- Safest minimal fix is to extend `ai-estimate` with deterministic XLSX parsing, not to redesign the whole pipeline
- This follows existing project patterns already proven in:
  - `src/components/office/OrderCalcView.tsx`
  - edge functions already using `npm:xlsx`
- Main non-breakage rule: preserve current PDF/image AI extraction while replacing only the unreliable spreadsheet branch
