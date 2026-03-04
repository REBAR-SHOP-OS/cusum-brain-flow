

# Fix: Shape Schematic Images Not Displaying

## Root Cause

The `AiVisionUploadDialog` saves the **storage path** (e.g., `SHAPE_NAME_123456.png`) to the `image_url` column — not a full URL. This is correct for security (signed URLs).

However, **MemberAreaView** (the admin grid) loads schematics and renders `<img src={s.image_url}>` using the raw storage path directly, which is not a valid URL. The images break because the browser can't resolve a bare filename like `SHAPE_NAME_123456.png`.

The `useShapeSchematics` hook already handles this correctly by generating signed URLs, but the admin grid doesn't use it.

## Fix

### 1. `src/components/office/MemberAreaView.tsx` — Generate signed URLs when loading schematics

In `loadSchematics()`, after fetching from DB, loop through results and generate signed URLs for each `image_url` that is a storage path (not already a full URL). This mirrors the logic in `useShapeSchematics.ts`.

```typescript
const loadSchematics = async () => {
  setLoadingSchematics(true);
  try {
    const { data, error } = await supabase
      .from("custom_shape_schematics")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      // Generate signed URLs for storage paths
      const withSignedUrls = await Promise.all(
        data.map(async (s) => {
          if (!s.image_url.startsWith("http")) {
            const { data: signedData } = await supabase.storage
              .from("shape-schematics")
              .createSignedUrl(s.image_url, 3600);
            return { ...s, image_url: signedData?.signedUrl || s.image_url };
          }
          return s;
        })
      );
      setSavedSchematics(withSignedUrls as UploadedSchematic[]);
    }
  } catch { /* silent */ }
  finally { setLoadingSchematics(false); }
};
```

### 2. Verify `useShapeSchematics.ts` signing logic

The hook already handles path detection and signing. The `extractStoragePath` function checks for both relative paths and full bucket URLs. No changes needed here — it already works for `AsaShapeDiagram` and `ProductionCard`.

### 3. Verify storage bucket RLS

Check that the `shape-schematics` bucket has a SELECT policy allowing authenticated users to read/download files, since signed URLs require this.

| File | Change |
|------|--------|
| `src/components/office/MemberAreaView.tsx` | Add signed URL generation in `loadSchematics()` |
| Storage RLS | Verify SELECT policy on `shape-schematics` bucket |

