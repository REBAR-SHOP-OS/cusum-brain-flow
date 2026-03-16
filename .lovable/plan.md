

# Clearance Photo Upload: Increase Limit, Add Compression, Speed Up

## Problems
1. **10MB limit too small** — shop floor photos from modern phones often exceed 10MB
2. **No image optimization** — raw full-res photos are uploaded as-is, wasting storage and slowing upload
3. **Slow upload flow** — photo uploads, then AI validation runs sequentially; no client-side compression

## Solution

### 1. `src/components/clearance/ClearanceCard.tsx` — Increase limit + client-side compression
- Raise `MAX_FILE_SIZE` from 10MB to **50MB** (matches server-side `upload-validation.ts` limit)
- Add a `compressImage()` utility that uses `<canvas>` to resize large photos to max 2048px on longest side and compress to JPEG ~80% quality before uploading
- This typically reduces a 15MB phone photo to ~500KB-1MB, making uploads much faster
- Update the toast message to reflect the new 50MB limit
- Update the `accept` attribute hint text

### 2. `src/lib/imageCompressor.ts` — New shared utility
Create a reusable image compressor:
```typescript
export async function compressImage(
  file: File, 
  maxDimension = 2048, 
  quality = 0.8
): Promise<File> {
  // Skip non-images or already small files
  if (!file.type.startsWith("image/") || file.size < 500_000) return file;
  
  // Load into canvas, resize, export as JPEG
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const canvas = new OffscreenCanvas(img.width * scale, img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}
```

### 3. `src/components/clearance/ClearanceCard.tsx` — Apply compression in upload flow
- In `handleUpload`, compress the file before uploading:
```typescript
const compressed = await compressImage(file);
// Then upload `compressed` instead of `file`
```
- This makes uploads dramatically faster (smaller file) and AI validation faster (smaller image to process)

### 4. Speed: Run upload and show progress
- Add a brief "Compressing..." state before "Uploading..." for UX clarity
- The compression + smaller file size will inherently speed up both upload and AI validation

## Summary of Changes
| File | Change |
|------|--------|
| `src/lib/imageCompressor.ts` | New — canvas-based image compressor |
| `src/components/clearance/ClearanceCard.tsx` | Raise limit to 50MB, compress before upload, update messages |

