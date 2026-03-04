

# Fix: Shape Schematic Images Not Displaying

## Root Cause

The upload dialog (`AiVisionUploadDialog.tsx`) correctly saves a **relative storage path** (e.g., `TYPE_T17_1234.png`) to the `image_url` column in `custom_shape_schematics`.

However, `useShapeSchematics.ts` has a flawed URL resolution strategy:

```text
image_url = "TYPE_T17_1234.png"  (relative path, not a URL)

extractStoragePath("TYPE_T17_1234.png")
  → doesn't contain "/object/public/shape-schematics/" marker
  → doesn't start with "http"
  → returns "TYPE_T17_1234.png" ✓ (correct path)

isCurrentProject = "TYPE_T17_1234.png".includes("rzqonxnow...")
  → false ✗ (BUG! It's a relative path, not a URL)

Result: signed URL is NEVER generated → raw path "TYPE_T17_1234.png" used as img src → broken image
```

The condition `isCurrentProject` is always `false` for relative paths because they don't contain any host. So the hook returns the raw storage path as the image URL, which is not a valid URL.

## Fix

In `useShapeSchematics.ts`, change the signed URL logic: if we have a valid storage path **and** the URL is NOT an external URL (doesn't start with `http`), always generate a signed URL. Only skip signing for external full URLs.

```typescript
// Before (broken):
if (path && isCurrentProject) {
  // generate signed URL
}
// External/public URL — use as-is

// After (fixed):
if (path) {
  // It's a storage path (either extracted from URL or already relative)
  // Always generate signed URL for storage paths
  const { data: signedData } = await supabase.storage
    .from("shape-schematics")
    .createSignedUrl(path, SIGNED_URL_EXPIRY);
  return { ...s, image_url: signedData?.signedUrl || s.image_url };
}
// Full external URL with no extractable path — use as-is
return s;
```

This works because `extractStoragePath` returns `null` for external URLs that don't match the bucket pattern, so those pass through untouched. For everything else (relative paths or URLs containing the bucket marker), we generate a signed URL.

## File Changed

| File | Change |
|------|--------|
| `src/hooks/useShapeSchematics.ts` | Remove broken `isCurrentProject` check; always sign when we have a valid storage path |

