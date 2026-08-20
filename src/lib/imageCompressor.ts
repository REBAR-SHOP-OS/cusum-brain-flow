/**
 * Client-side image compression utility.
 * Resizes large photos and compresses to JPEG before upload.
 */
export async function compressImage(
  file: File,
  maxDimension = 2048,
  quality = 0.8
): Promise<File> {
  // Skip non-images or already small files (<500KB)
  if (!file.type.startsWith("image/") || file.size < 500_000) return file;

  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // fallback if no 2d context
  ctx.drawImage(img, 0, 0, w, h);
  img.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  const newName = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], newName, { type: "image/jpeg" });
}
