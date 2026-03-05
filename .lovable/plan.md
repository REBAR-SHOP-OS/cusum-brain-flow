

# Fix Broken Shape Schematic Images

## Problem

The `custom_shape_schematics` table has **140 rows**: 71 with old URLs pointing to a **different project** (`uavzziigfnqpfdkczbdo.supabase.co`) and 69 with relative filenames pointing to the **current project's** private `shape-schematics` bucket.

There are duplicate entries per shape code (one old URL, one new relative path). The `useShapeSchematics` hook loads all rows and the lookup map keeps the **last** entry per code. Depending on database ordering, it may resolve to the old broken URL.

Additionally, the old URLs contain the path marker `/object/public/shape-schematics/` which `extractStoragePath()` extracts and tries to sign against the **current** project's bucket — but those files don't exist here, so the signed URL fails silently and the image breaks.

## Fix

### 1. Delete old/orphaned records (database migration)

Remove all 71 rows that point to `uavzziigfnqpfdkczbdo.supabase.co`. The new relative-path rows already cover every shape code.

```sql
DELETE FROM custom_shape_schematics 
WHERE image_url LIKE 'https://uavzziigfnqpfdkczbdo%';
```

### 2. Make bucket public OR fix signed URL RLS

The bucket `shape-schematics` is **private** (`public: false`). The `createSignedUrl` call in `useShapeSchematics` requires the authenticated user to have storage RLS permission. If the operator's session is stale or the storage policies are restrictive, signing fails silently.

Two options (recommend option A for shop floor reliability):

**Option A**: Make the bucket public — these are generic ASA shape diagrams, not sensitive data. Then use public URLs directly instead of signing.

**Option B**: Add a storage RLS policy allowing authenticated users to read from the bucket.

### 3. Update `useShapeSchematics` hook

After cleaning duplicates, simplify the hook:
- If bucket is made public: construct public URLs directly (`${SUPABASE_URL}/storage/v1/object/public/shape-schematics/${path}`) — no signing needed.
- Add error handling so a failed image load falls back to the built-in SVG path.

## Files to change

| File | Change |
|------|--------|
| Migration SQL | Delete 71 orphaned rows pointing to old project |
| Storage config | Make `shape-schematics` bucket public (or add RLS policy) |
| `src/hooks/useShapeSchematics.ts` | Use public URLs instead of signed URLs; add error fallback |

