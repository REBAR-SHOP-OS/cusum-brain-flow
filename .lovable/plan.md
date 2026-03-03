

# Fix: Broken Shape Schematic Images

## Root Cause
The `custom_shape_schematics` table stores image URLs pointing to a previous project's **public** storage bucket (`uavzziigfnqpfdkczbdo.supabase.co/storage/v1/object/public/shape-schematics/...`).

The `useShapeSchematics` hook in `src/hooks/useShapeSchematics.ts` extracts the storage path from these URLs and tries to generate **signed URLs** from the current project's `shape-schematics` bucket — where the files don't exist. Result: broken images.

## Fix

### `src/hooks/useShapeSchematics.ts`
The URLs are already **public** URLs (note `/object/public/` in the path). They work as-is — no signed URL generation needed.

**Change**: Skip signed URL generation when the URL domain doesn't match the current project. Since these are public URLs from another host, just use them directly.

Specifically, in the `fetchSchematics` function, only attempt signed URL creation if the URL contains the current project's Supabase domain. Otherwise, use the original `image_url` as-is:

```ts
const CURRENT_HOST = new URL(import.meta.env.VITE_SUPABASE_URL).host;

// In the map:
const path = extractStoragePath(s.image_url);
const isCurrentProject = s.image_url.includes(CURRENT_HOST);

if (path && isCurrentProject) {
  // Generate signed URL for current project's private bucket
  const { data: signedData } = await supabase.storage...
} else {
  // External/public URL — use as-is
  return s;
}
```

Single file change, no migration needed.

