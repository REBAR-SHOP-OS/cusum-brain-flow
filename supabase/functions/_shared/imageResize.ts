/**
 * Server-side image crop/resize to enforce aspect ratios.
 * Uses ImageScript (pure JS, Deno-compatible) — no native canvas needed.
 *
 * Accepts named ratios ("16:9", "9:16", "1:1", "4:5", "3:2", etc.)
 * and explicit WxH strings ("1024x1536"). Unknown/empty values pass through.
 */
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

/** Maximum output dimension on either axis */
const MAX_DIM = 2048;

/**
 * Parse a ratio string into target width & height (pixels).
 * Supports:
 *   "16:9"       → landscape
 *   "9:16"       → portrait
 *   "1:1"        → square
 *   "4:5", "3:2" → any named ratio
 *   "1024x1536"  → explicit WxH
 *   ""           → null (skip)
 */
function resolveTargetDimensions(ratio: string): { w: number; h: number } | null {
  if (!ratio || !ratio.trim()) return null;

  const r = ratio.trim();

  // Explicit WxH (e.g. "1024x1536")
  const wxhMatch = r.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (wxhMatch) {
    const w = Math.min(parseInt(wxhMatch[1]), MAX_DIM);
    const h = Math.min(parseInt(wxhMatch[2]), MAX_DIM);
    if (w > 0 && h > 0) return { w, h };
    return null;
  }

  // Named ratio (e.g. "16:9", "4:5")
  const ratioMatch = r.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (ratioMatch) {
    const rw = parseFloat(ratioMatch[1]);
    const rh = parseFloat(ratioMatch[2]);
    if (rw <= 0 || rh <= 0) return null;

    // Compute pixel dimensions: fit the longer side to a sensible max
    const aspect = rw / rh;
    let w: number, h: number;
    if (aspect >= 1) {
      // Landscape or square
      w = Math.min(1536, MAX_DIM);
      h = Math.round(w / aspect);
    } else {
      // Portrait
      h = Math.min(1536, MAX_DIM);
      w = Math.round(h * aspect);
    }
    // Ensure minimums
    w = Math.max(w, 256);
    h = Math.max(h, 256);
    return { w, h };
  }

  // Unknown format
  console.warn(`[imageResize] Cannot parse ratio "${r}", skipping crop`);
  return null;
}

/**
 * Center-crops and resizes image bytes to match the given aspect ratio.
 * Returns PNG bytes. If ratio is unknown/empty or processing fails, returns original bytes.
 */
export async function cropToAspectRatio(
  imageBytes: Uint8Array,
  ratio: string
): Promise<Uint8Array> {
  const target = resolveTargetDimensions(ratio);
  if (!target) {
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
