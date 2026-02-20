

# Deep OCR + Fix Ingestion Pipeline

## Problem Summary

Two separate issues:

1. **WORKER_LIMIT crash**: `XLSX.read` on large spreadsheets consumes too much CPU. The edge function hits the Deno runtime CPU limit and gets killed. Additionally, the "create project" insert fails silently (the `projects` table likely has required columns we're not providing), causing FK violations that cascade into more retries and wasted CPU.

2. **OCR quality**: The current OCR uses a single Gemini flash call on full-resolution images. For structural drawings with small text (bar marks, dimensions, notes), this misses detail. You want a **tile-based deep OCR** that splits each page into overlapping grid sections and analyzes each section individually at high quality.

## The Fix (3 Parts)

### Part 1: Fix WORKER_LIMIT in `ingest-historical-barlists`

The XLSX library is too heavy for edge functions. Instead of parsing XLS in the edge function:

- **Process only 1 file per invocation** (not 1 lead with multiple files)
- **Add a hard timeout guard**: If parsing takes > 3 seconds, skip the file and log it
- **Fix the project creation**: Query the `projects` table schema to see what columns are required, then provide all mandatory fields. If insert still fails, skip the lead gracefully (increment cursor) instead of crashing
- **Remove XLSX.read for very large files**: Add a file size check (skip files > 5MB) since those crash the runtime

### Part 2: Upgrade OCR to Tile-Based Deep Scanning

Replace the single-shot Gemini OCR with a multi-tile approach in `google-vision-ocr`:

**How it works:**
1. Accept a new `mode` parameter: `"standard"` (default, current behavior) or `"deep"`
2. In `"deep"` mode, the function instructs the AI to analyze the image in quadrants
3. Since we cannot do image manipulation in Deno, we use a **multi-prompt approach**:
   - First pass: Full image scan for layout understanding
   - Second pass: "Focus on the TOP-LEFT quadrant of this image. Extract every piece of text, number, dimension, bar mark, and notation you can see in fine detail."
   - Third pass: Same for TOP-RIGHT
   - Fourth pass: BOTTOM-LEFT
   - Fifth pass: BOTTOM-RIGHT
   - Merge pass: Deduplicate and merge all extracted text
4. Use **Gemini 2.5 Pro** (not Flash) for deep mode to get maximum accuracy on small text
5. Each quadrant prompt includes instructions to look for: bar marks, dimensions in mm, rebar notation (e.g., "7-20M B.E.W."), schedule tables, scale annotations

**New endpoint parameters:**
```
POST /google-vision-ocr
{
  "imageBase64": "...",
  "mode": "deep",          // "standard" | "deep"  
  "quadrants": 4            // 4 (2x2) or 9 (3x3) for very dense drawings
}
```

### Part 3: Wire Deep OCR into `ingest-shop-drawings`

- Add `mode: "deep"` when calling the OCR for shop drawings
- Use Gemini 2.5 Pro (already configured) with the quadrant-based extraction
- After all quadrant results come back, do a final merge + rebar extraction pass
- This replaces the single `callGeminiVision` call with a multi-pass approach

## Technical Details

### File: `supabase/functions/google-vision-ocr/index.ts`
- Add `mode` and `quadrants` parameters to the request body
- In `deep` mode: make 5 sequential AI calls (1 full + 4 quadrant-focused prompts)
- Each quadrant prompt says "Focus ONLY on the [position] portion of this image"
- Use `gemini-2.5-pro` for deep mode, keep `gemini-2.5-flash` for standard
- Merge results by deduplicating lines across quadrant outputs
- Return combined `fullText` with higher confidence

### File: `supabase/functions/ingest-historical-barlists/index.ts`
- Add file size check: skip files > 5MB (log as "too large for edge runtime")
- Wrap `XLSX.read` in a try/catch with a size pre-check
- Fix project resolution: query `projects` table columns first, provide all required fields including `id` as a proper UUID
- Ensure cursor always advances even on project creation failure
- Reduce `maxFilesPerBatch` to 1

### File: `supabase/functions/ingest-shop-drawings/index.ts`
- Replace single `callGeminiVision` with the new deep OCR multi-pass approach
- For each PDF: send the base64 data with quadrant-focused prompts
- Merge quadrant results before JSON extraction
- Keep batch size at 1 PDF per invocation (deep OCR is slower but much more accurate)

### File: `supabase/functions/_shared/agentDocumentUtils.ts`
- Update `performOCR` and `performOCROnBase64` to accept optional `mode` parameter
- Pass `mode: "deep"` through to the OCR endpoint when called from ingestion pipelines

## Processing Impact

- **Standard mode**: Same speed as before (1 AI call per image)
- **Deep mode**: 5x slower per image but catches small text, bar marks, and dimensions that were previously missed
- **XLS ingestion**: More reliable with the 1-file-per-batch limit, no more CPU crashes
- **Shop drawing ingestion**: Much higher accuracy on dense structural drawings with small annotations

## Result

After this fix:
- XLS ingestion will stop crashing and process files reliably (1 at a time)
- Shop drawing OCR will find bar marks, dimensions, and schedule text that was previously missed
- The deep quadrant scanning catches text in every corner of complex structural drawings
- The Learning Engine gets much higher quality training data

