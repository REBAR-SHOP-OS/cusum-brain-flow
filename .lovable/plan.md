

# Fix: Odoo Import Audit — Reconcile Storage vs DB

## Confirmed Audit Results

| Metric | Count |
|--------|-------|
| Total `lead_files` with `odoo_id` | 15,787 |
| Records claiming `storage_path` | 527 |
| Actually matched to real storage files | **5** |
| Ghost DB records (path set, no file) | **522** |
| Orphaned storage files (file exists, no DB link) | **276** |
| Chatter activities synced | 39,836 across 2,780 leads |
| Scheduled activities synced | 10,338 across 567 leads |
| Total Odoo leads | 3,056 |

Chatter and scheduled activities are properly imported and mapped — no issues there. The problem is exclusively with **file storage reconciliation**.

## Plan

### Step 1: SQL Data Fix — Reconcile orphans and ghosts

Two data operations (not schema changes, using insert/update tool):

**A. Link 276 orphaned storage files** — verified the join works perfectly:
```sql
UPDATE lead_files lf
SET storage_path = o.name,
    file_url = o.name
FROM storage.objects o
WHERE o.bucket_id = 'estimation-files'
  AND o.name LIKE 'odoo-archive/%'
  AND lf.odoo_id = split_part(split_part(o.name, '/', 3), '-', 1)::int
  AND lf.storage_path IS NULL;
```

**B. Clear 522 ghost records** — reset to Odoo download URL:
```sql
UPDATE lead_files lf
SET storage_path = NULL,
    file_url = 'https://rebarshop-24-rebar-shop.odoo.com/web/content/' || odoo_id || '?download=true'
WHERE storage_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
    WHERE o.bucket_id = 'estimation-files' AND o.name = lf.storage_path
  );
```

### Step 2: Fix `OdooDumpImportDialog.tsx` — Prevent future mismatches

Move the DB update so it only runs after confirmed upload or confirmed skip:

```typescript
if (alreadyInStorage) {
  skipped++;
} else {
  await retryAsync(async () => { /* upload */ });
}

// Generate proper public URL
const { data: urlData } = supabase.storage
  .from("estimation-files")
  .getPublicUrl(storagePath);

// DB update — only reached if above succeeded (no throw)
await supabase.from("lead_files").update({
  storage_path: storagePath,
  file_url: urlData.publicUrl || storagePath,
}).eq("odoo_id", p.odoo_id).is("storage_path", null);
```

Key change: store proper public URL in `file_url` instead of raw storage path.

| File | Change |
|------|--------|
| Database (data fix) | Link 276 orphans + clear 522 ghosts |
| `src/components/admin/OdooDumpImportDialog.tsx` | Use `getPublicUrl` for `file_url`; DB update only after success |

