

# Fix: Odoo Dump Import — All Files "Failed to fetch"

## Root Cause

The `OdooDumpImportDialog` uses `zip.js` to read entries from the ZIP file. The `processQueue` function attempts to decompress multiple entries **concurrently** (`Promise.all` with BATCH=3) by calling `entry.getData(new BlobWriter())` inside the upload loop. However, `zip.js` does **not support concurrent reads** from the same `ZipReader` — only one entry can be decompressed at a time. This causes all concurrent `getData()` calls to fail with "Failed to fetch".

Additionally, the `retryAsync` wrapper re-calls `getBlob()` on each retry, but a zip entry that already started (and failed) decompression may not be re-readable.

## Fix

### 1. Pre-extract blobs sequentially before uploading

In `handleZipSelect`, after matching entries to pending files, extract all blobs **sequentially** from the ZIP (one at a time), storing them in memory. Then close the ZipReader. Then pass pre-extracted blobs to `processQueue`.

```typescript
// After matching, extract blobs sequentially
const queue: QueueItem[] = [];
for (const entry of entries) {
  // ... match logic same as before ...
  if (match) {
    setStatusMsg(`Extracting ${match.mapping.name}…`);
    const blob = await entry.getData(new BlobWriter());
    queue.push({
      pending: match.pending,
      mapping: match.mapping,
      getBlob: async () => blob, // Already extracted — just return it
    });
  }
}
await reader.close(); // Safe to close now
await processQueue(queue);
```

### 2. Upload batches can stay concurrent

Since blobs are pre-extracted and held in memory, the `Promise.all` batch upload to Supabase Storage works fine — no more concurrent zip reads.

### 3. Add memory guard for very large ZIPs

Add a running byte counter during extraction. If total extracted size exceeds ~1.5GB, warn the user and suggest smaller batches. For typical Odoo dumps (a few hundred attachments), this won't be an issue.

| File | Change |
|------|--------|
| `src/components/admin/OdooDumpImportDialog.tsx` | Pre-extract blobs sequentially before uploading; close ZipReader before processQueue |

