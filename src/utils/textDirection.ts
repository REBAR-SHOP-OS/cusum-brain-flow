/**
 * Strip invisible Unicode directional markers that Scribe may inject.
 */
export function stripDirectionalMarkers(text: string): string {
  return text.replace(/[\u200F\u200E\u202A-\u202E\u2066-\u2069]/g, "");
}

/**
 * Detect if text content is RTL (Persian, Arabic, Hebrew, etc.)
 * using a ratio-based approach: count actual RTL script chars vs Latin chars.
 */
export function detectRtl(text: string): boolean {
  if (!text) return false;
  const clean = stripDirectionalMarkers(text);
  const rtlChars = (clean.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const ltrChars = (clean.match(/[a-zA-Z]/g) || []).length;
  if (rtlChars === 0 && ltrChars === 0) return false;
  return rtlChars > ltrChars;
}
