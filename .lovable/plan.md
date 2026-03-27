

# Audit, Optimize & Fix — Edge Function Issues

## Issues Found

### Issue 1: `ai-estimate` — Client timeout at 120s while server takes 176s
The AI extraction call to `google/gemini-2.5-pro` with large PDFs takes 120-180s. The client `invokeEdgeFunction` has a 120s timeout, so it aborts before the server finishes (which succeeds at 176s).

**Fix**: Increase client timeout from 120s to 180s in `GenerateQuotationDialog.tsx` line 237. Also switch the AI model from `gemini-2.5-pro` to `gemini-2.5-flash` in `ai-estimate/index.ts` line 519 — Flash is faster for structured extraction and handles this workload in ~60-90s instead of 150-180s, while maintaining extraction quality. Add a retry with `retries: 1` for timeout resilience.

### Issue 2: `ringcentral-sync` — `ReferenceError: serve is not defined`
Line 619 uses `serve(async (req) => {` but never imports or defines `serve`. This is the old Deno pattern — should be `Deno.serve`.

**Fix**: Change `serve(async (req) => {` to `Deno.serve(async (req) => {` on line 619.

### Issue 3: `analyze-feedback-fix` — `Maximum call stack size exceeded`
Screenshot fetch fails with stack overflow when converting large images to base64 via string concatenation. This is a known issue with large binary data.

**Fix**: In `analyze-feedback-fix/index.ts` (~line 105), replace the recursive/string-concat base64 conversion with chunked array-based conversion using `Uint8Array` and building the base64 string in 8KB chunks.

## Files Changed
- `src/components/accounting/GenerateQuotationDialog.tsx` — increase timeout to 180s, add 1 retry
- `supabase/functions/ai-estimate/index.ts` — switch model to `gemini-2.5-flash` for speed
- `supabase/functions/ringcentral-sync/index.ts` — fix `serve` → `Deno.serve`
- `supabase/functions/analyze-feedback-fix/index.ts` — fix stack overflow in base64 conversion

