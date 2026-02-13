

# Fix: Remove 1000-Row Query Limit on Pending Files

## Problem
The database query fetching pending files uses the default Supabase limit of 1,000 rows. With 17,366 pending files, only ~1,000 are returned, so most filestore entries in the ZIP never get matched -- explaining why only 407 out of thousands were uploaded.

## Fix

### File: `src/components/admin/OdooDumpImportDialog.tsx`

**Paginate the pending files query** to fetch ALL 17,366 records instead of just the first 1,000.

Replace the single query (lines 214-218):
```typescript
const { data, error } = await supabase
  .from("lead_files")
  .select("odoo_id, lead_id, file_name")
  .not("odoo_id", "is", null)
  .is("storage_path", null);
```

With a paginated loop that fetches in batches of 1,000:
```typescript
const allPending: PendingFile[] = [];
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await supabase
    .from("lead_files")
    .select("odoo_id, lead_id, file_name")
    .not("odoo_id", "is", null)
    .is("storage_path", null)
    .range(from, from + PAGE - 1);
  if (error) {
    toast.error("Failed to fetch pending files");
    await reader.close();
    return;
  }
  allPending.push(...(data as unknown as PendingFile[]));
  if (data.length < PAGE) break;
  from += PAGE;
}
setStatusMsg(`Found ${allPending.length} pending files in database`);
```

Then use `allPending` instead of `pending` for the matching logic below.

This is the only change needed. Re-running the import with the same ZIP should match and upload all files in the filestore.
