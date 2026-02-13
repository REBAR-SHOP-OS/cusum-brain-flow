
# Fix: Add Retry Logic for Transient Upload Failures

## Problem
"Failed to fetch" is a browser-level network error occurring during `supabase.storage.upload()`. When uploading 8,000+ files over a long period, transient network hiccups (timeouts, connection resets) cause some uploads to fail permanently. These are recoverable errors that just need a retry.

## Fix

### File: `src/components/admin/OdooDumpImportDialog.tsx`

Add a retry wrapper (3 attempts with exponential backoff) around the blob extraction + upload logic inside the `processQueue` function.

**Changes:**

1. Add a `retryAsync` helper function at the top of the file:
```typescript
async function retryAsync<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error("unreachable");
}
```

2. Wrap the blob fetch + upload inside `retryAsync` in the batch processing loop (around lines 142-153):
```typescript
batch.map(async ({ pending: p, mapping: m, getBlob }) => {
  try {
    await retryAsync(async () => {
      const blob = await getBlob();
      const safeName = m.name.replace(/[^\w.\-]/g, "_");
      const storagePath = `odoo-archive/${p.lead_id}/${p.odoo_id}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("estimation-files")
        .upload(storagePath, blob, {
          contentType: m.mimetype || "application/octet-stream",
          upsert: true,
        });
      if (upErr) throw upErr;
    });
    // DB update stays outside retry (idempotent but no need to repeat)
    const safeName = m.name.replace(/[^\w.\-]/g, "_");
    const storagePath = `odoo-archive/${p.lead_id}/${p.odoo_id}-${safeName}`;
    const { error: dbErr } = await supabase
      .from("lead_files")
      .update({ storage_path: storagePath, file_url: storagePath } as any)
      .eq("odoo_id", p.odoo_id)
      .is("storage_path", null);
    if (dbErr) throw dbErr;
    ok++;
  } catch (err: any) {
    fail++;
    errs.push(`${m.name}: ${err?.message ?? "unknown"}`);
  }
})
```

This gives each file 3 attempts with 1s / 2s / 4s delays before marking it as failed. Re-running the import afterwards will also pick up any remaining failures since it only targets rows where `storage_path IS NULL`.
