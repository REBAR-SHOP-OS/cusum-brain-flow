

## Fix: PDF Files Failing in AI Estimation (Takeoff Wizard)

### Root Cause
The edge function logs show the exact error:
```
Unsupported image format for URL: ...SOUTHSIDE_AQUATIC_CENTRE_RENOVATION_Estimation_File.pdf
Supported formats: PNG, JPEG, WebP, GIF. For other formats, use a data URL with the MIME type specified.
```

The `ai-estimate` function passes PDF URLs directly as `image_url` references to the AI gateway. The gateway only accepts image URLs (PNG/JPEG/WebP/GIF) — PDFs must be sent as **base64 data URLs** with the MIME type specified (`data:application/pdf;base64,...`).

Since the extraction returns 0 items, the wizard shows 0/0/$0 and the quotation is empty.

### Fix

**File: `supabase/functions/ai-estimate/index.ts`** (lines 148-268)

Replace the current "pass URL directly as image_url" approach with:

1. **Download each file** from the public storage URL
2. **Detect MIME type** from the URL extension (`.pdf` → `application/pdf`, `.png` → `image/png`, etc.)
3. **For PDFs**: Convert to base64 and send as `data:application/pdf;base64,...` data URL
4. **For images** (PNG/JPEG/WebP/GIF): Keep using the direct URL (already works)
5. **Increase `max_tokens`** to 16000 — PDF bar lists can be dense and 8000 may truncate large schedules

The key change in the content parts builder:

```typescript
for (const url of file_urls.slice(0, 4)) {
  const lower = url.toLowerCase();
  const isPdf = lower.includes('.pdf');
  const isImage = /\.(png|jpg|jpeg|webp|gif)/.test(lower);

  if (isPdf) {
    // Download and convert to base64 data URL
    const res = await fetch(url);
    if (!res.ok) { console.error(`Failed to fetch ${url}`); continue; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const b64 = btoa(String.fromCharCode(...bytes));  // chunked for large files
    contentParts.push({
      type: "image_url",
      image_url: { url: `data:application/pdf;base64,${b64}` }
    });
  } else if (isImage) {
    contentParts.push({ type: "image_url", image_url: { url } });
  }
}
```

For large PDFs, use a chunked base64 encoder to avoid call-stack overflow from `String.fromCharCode(...bytes)` with huge arrays.

**Also increase the file limit** from `slice(0, 2)` to `slice(0, 4)` to handle multi-page estimation files.

### Additional: Handle Spreadsheets (XLSX/CSV)
Currently only images are handled. For `.csv` files, download and pass as text content. For `.xlsx`, convert to base64 data URL similarly to PDFs.

### No other files need changes
The TakeoffWizard frontend and `analyze-scope` function are fine — only the `ai-estimate` edge function needs this fix.

