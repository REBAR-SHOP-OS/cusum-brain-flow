

# Fix: Odoo Dump Import — Skip Already-Imported Files

## Problem
The import doesn't check if a file already exists in storage before uploading. If a previous import partially succeeded (file uploaded but DB not updated), re-running re-uploads everything.

## Changes

### `src/components/admin/OdooDumpImportDialog.tsx`

**1. Before uploading each file, check if it already exists in storage**
In `processQueue`, before calling `supabase.storage.upload`, check if the file already exists at the target path. If it does, skip the upload and just update the DB record.

```typescript
// Inside processQueue batch.map:
const storagePath = `odoo-archive/${p.lead_id}/${p.odoo_id}-${safeName}`;

// Check if file already exists in storage
const { data: existingFile } = await supabase.storage
  .from("estimation-files")
  .list(`odoo-archive/${p.lead_id}`, { search: `${p.odoo_id}-${safeName}` });

const alreadyInStorage = existingFile && existingFile.length > 0;

if (!alreadyInStorage) {
  // Upload only if not already there
  await retryAsync(async () => { /* upload logic */ });
}

// Always update DB record
await supabase.from("lead_files").update({ storage_path, file_url: storagePath })
  .eq("odoo_id", p.odoo_id).is("storage_path", null);
```

**2. Show skip count in status**
Track and display how many files were skipped (already existed) vs newly uploaded.

**3. Also improve the relPath matching**
Add fallback matching: if `store_fname` doesn't match the ZIP path directly, also try matching by just the filename portion (after last `/`), to handle slight path differences in different Odoo dump formats.

| File | Change |
|------|--------|
| `src/components/admin/OdooDumpImportDialog.tsx` | Add storage existence check before upload; add skip counter; improve path matching fallback |

