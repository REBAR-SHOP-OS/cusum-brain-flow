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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 60)}`));
    img.src = src;
  });
}
