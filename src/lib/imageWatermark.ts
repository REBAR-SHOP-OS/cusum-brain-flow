/**
 * Composites a logo onto an image using Canvas.
 * Returns a data URL of the final branded image.
 */
export async function applyLogoToImage(
  imageUrl: string,
  logoUrl: string,
  opacity = 0.85
): Promise<string> {
  const [img, logo] = await Promise.all([loadImage(imageUrl), loadImage(logoUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw base image
  ctx.drawImage(img, 0, 0);

  // Logo sizing: ~15% of image width, maintain aspect ratio
  const logoMaxW = canvas.width * 0.15;
  const scale = logoMaxW / logo.naturalWidth;
  const logoW = logo.naturalWidth * scale;
  const logoH = logo.naturalHeight * scale;

  // Position: bottom-right with 4% padding
  const pad = canvas.width * 0.04;
  const x = canvas.width - logoW - pad;
  const y = canvas.height - logoH - pad;

  ctx.globalAlpha = opacity;
  ctx.drawImage(logo, x, y, logoW, logoH);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/png");
}

/**
 * Ensures an image is square (1:1). Crops from center if not.
 * Returns a data URL of the squared image.
 */
export async function ensureSquare(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const size = Math.min(img.naturalWidth, img.naturalHeight);

  if (img.naturalWidth === img.naturalHeight) return imageUrl;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const sx = (img.naturalWidth - size) / 2;
  const sy = (img.naturalHeight - size) / 2;
  ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

  return canvas.toDataURL("image/png");
}

/**
 * Ensures an image is true 9:16 portrait at exactly 1080×1920.
 * Center-crops then resizes to the canonical Story canvas. Throws if
 * the input cannot be loaded — callers must treat that as a hard failure
 * so a square image can never reach the calendar.
 */
export const STORY_TARGET_W = 1080;
export const STORY_TARGET_H = 1920;

export async function ensurePortrait(imageUrl: string): Promise<string> {
  const img = await loadImage(imageUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error("ensurePortrait: source has no dimensions");

  const targetRatio = STORY_TARGET_W / STORY_TARGET_H; // 9/16
  const currentRatio = w / h;

  let cropW: number, cropH: number;
  if (currentRatio > targetRatio) {
    // Too wide — crop width
    cropH = h;
    cropW = Math.round(h * targetRatio);
  } else {
    // Too tall (or square) — crop height
    cropW = w;
    cropH = Math.round(w / targetRatio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = STORY_TARGET_W;
  canvas.height = STORY_TARGET_H;
  const ctx = canvas.getContext("2d")!;

  const sx = (w - cropW) / 2;
  const sy = (h - cropH) / 2;
  // Draw the center-crop directly resampled into the canonical 1080×1920 canvas.
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, STORY_TARGET_W, STORY_TARGET_H);

  if (canvas.width !== STORY_TARGET_W || canvas.height !== STORY_TARGET_H) {
    throw new Error(`ensurePortrait: canvas mismatch ${canvas.width}×${canvas.height}`);
  }
  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 60)}`));
    img.src = src;
  });
}
