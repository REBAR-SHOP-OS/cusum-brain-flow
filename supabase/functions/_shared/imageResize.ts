/**
 * Server-side image crop/resize to enforce aspect ratios.
 * Uses ImageScript (pure JS, Deno-compatible) — no native canvas needed.
 */
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const TARGET_DIMENSIONS: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1536, h: 864 },
  "9:16": { w: 864, h: 1536 },
  "1:1": { w: 1024, h: 1024 },
};

/**
 * Center-crops and resizes image bytes to match the given aspect ratio.
 * Returns PNG bytes. If ratio is unknown or processing fails, returns original bytes.
 */
export async function cropToAspectRatio(
  imageBytes: Uint8Array,
  ratio: string
): Promise<Uint8Array> {
  const target = TARGET_DIMENSIONS[ratio];
  if (!target) {
    console.warn(`[imageResize] Unknown ratio "${ratio}", skipping crop`);
    return imageBytes;
  }

  try {
    const img = await Image.decode(imageBytes);
    const srcW = img.width;
    const srcH = img.height;
    const targetRatio = target.w / target.h;
    const srcRatio = srcW / srcH;

    let cropX = 0;
    let cropY = 0;
    let cropW = srcW;
    let cropH = srcH;

    if (srcRatio > targetRatio) {
      // Image is too wide — crop sides
      cropW = Math.round(srcH * targetRatio);
      cropX = Math.round((srcW - cropW) / 2);
    } else if (srcRatio < targetRatio) {
      // Image is too tall — crop top/bottom
      cropH = Math.round(srcW / targetRatio);
      cropY = Math.round((srcH - cropH) / 2);
    }

    const cropped = img.crop(cropX, cropY, cropW, cropH);
    const resized = cropped.resize(target.w, target.h);
    const pngBytes = await resized.encode();

    console.log(
      `[imageResize] Cropped ${srcW}x${srcH} → ${cropW}x${cropH} → resized to ${target.w}x${target.h} (ratio: ${ratio})`
    );

    return new Uint8Array(pngBytes);
  } catch (err) {
    console.error(`[imageResize] Failed to crop image: ${err instanceof Error ? err.message : String(err)}`);
    return imageBytes;
  }
}
