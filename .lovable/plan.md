
# Fix: AI Takeoff Returns 0 Items

## Root Cause Analysis

The takeoff pipeline has **3 breaking points** in sequence:

1. **Storage bucket is private** -- The `estimation-files` bucket is set to `public: false`, but `TakeoffWizard.tsx` uses `getPublicUrl()` to generate download URLs. When the `pdf-to-images` edge function tries to fetch that URL, storage returns HTTP 400. This is confirmed in the logs: `"Failed to fetch PDF: 400"`.

2. **`pdf-to-images` function is broken** -- The function body references a local `convertPdfToImages(pdfData, maxPages, dpi)` function, but its implementation was lost (replaced by a `// ... keep existing code` placeholder). Even if the URL worked, this function would crash.

3. **No pricing data** -- `estimation_pricing` has 0 active rows, so all cost calculations return $0 even if items were extracted.

**Result**: PDF cant be fetched -> no images -> no OCR -> no AI extraction -> 0 items, 0 weight, 0 cost.

## Fix Plan

### Fix 1: Make storage bucket public (or use signed URLs)

Make the `estimation-files` bucket public so edge functions can fetch uploaded PDFs. This is the simplest fix since estimation files are project drawings (not sensitive PII).

**SQL Migration:**
```sql
UPDATE storage.buckets SET public = true WHERE id = 'estimation-files';
```

### Fix 2: Rewrite `pdf-to-images/index.ts` with working PDF conversion

The current approach of converting PDFs to images in Deno is complex and broken. Instead, skip the PDF-to-images step entirely and send the PDF URL directly to Gemini for vision analysis. Gemini 2.5 Pro/Flash natively supports PDF input via URL.

**Changes to `supabase/functions/ai-estimate/index.ts`:**
- Remove the `pdf-to-images` call entirely
- Send file URLs (PDF or image) directly to Gemini as multipart content (Gemini supports PDF natively)
- Use `google/gemini-2.5-pro` with the PDF URL in the vision message
- This eliminates the broken PDF-to-images and separate OCR steps

The updated flow becomes:
```
Upload PDF -> Send PDF URL directly to Gemini 2.5 Pro (vision) -> Extract rebar items -> Calculate -> Save
```

Instead of the old broken flow:
```
Upload PDF -> pdf-to-images (BROKEN) -> google-vision-ocr (NEVER REACHED) -> Extract -> Calculate -> Save
```

### Fix 3: Seed `estimation_pricing` with real data

**SQL Migration** to insert standard Canadian rebar pricing for the company:

| Bar Size | Material Cost/kg | Labor Rate/hr | kg/Labor Hour |
|----------|-----------------|---------------|---------------|
| 10M | $1.65 | $75.00 | 250 |
| 15M | $1.55 | $75.00 | 300 |
| 20M | $1.45 | $75.00 | 350 |
| 25M | $1.40 | $75.00 | 400 |
| 30M | $1.35 | $75.00 | 400 |
| 35M | $1.30 | $75.00 | 450 |

### Fix 4: Update TakeoffWizard to use signed URLs (backup)

If we make the bucket public (Fix 1), `getPublicUrl()` will work. But as a safety measure, also add signed URL generation as a fallback.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ai-estimate/index.ts` | Replace PDF-to-images + OCR pipeline with direct Gemini PDF vision |
| `supabase/functions/pdf-to-images/index.ts` | Rebuild with working implementation (for other callers) |
| Database migration | Make bucket public + seed pricing data |

## Technical Details

- Gemini 2.5 Pro supports PDF files directly via `fileData` or `image_url` in vision messages
- The `callAI` function in `aiRouter.ts` already supports multipart content messages
- This approach is faster (1 AI call instead of N OCR calls + 1 extraction call) and more reliable
- Rebar standards table already has 6 rows (10M-35M) so calculations will work once items are extracted
