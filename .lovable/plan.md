

# Fix "Failed to upload report" — Root Cause and Permanent Fix

## Root Cause

The edge function `generate-daily-report-pdf` generates an HTML report via AI, then tries to upload it to the `invoice-pdfs` storage bucket. The upload fails silently — the actual storage error is swallowed (only "Failed to upload report" is thrown without logging `uploadError.message`).

The storage bucket `invoice-pdfs` exists but contains **zero objects**, confirming uploads have never succeeded from this function. This is likely a storage RLS/permissions issue with the bucket configuration for edge function uploads.

## Permanent Fix: Eliminate Storage Dependency

Instead of uploading to storage and generating a signed URL, **return the HTML content directly in the edge function response**. The client already opens the result in a new tab — we can use a `data:` URI or a Blob URL instead.

This eliminates the storage upload entirely, making the feature faster and more reliable.

### 1. `supabase/functions/generate-daily-report-pdf/index.ts`

- Remove both storage upload + signed URL blocks (lines 98-115 and 181-197)
- Instead, return the HTML content directly in the JSON response: `{ html: htmlDoc }`
- Add proper error logging for debugging: log the full error before throwing

### 2. `src/components/vizzy/VizzyBrainPanel.tsx` — `GeneralReportPDFButton`

- After receiving `data.html`, create a Blob URL and open it in a new tab:
  ```typescript
  const blob = new Blob([data.html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  ```
- Remove the old `data.url` handling
- Keep the existing error handling

| File | Change |
|------|--------|
| `generate-daily-report-pdf/index.ts` | Return HTML directly instead of uploading to storage |
| `VizzyBrainPanel.tsx` | Use Blob URL from returned HTML instead of signed URL |

This fix is permanent because it removes the storage dependency that was causing the failure. The report opens instantly in a new tab as a fully styled HTML document.

