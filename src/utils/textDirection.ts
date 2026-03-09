/**
 * Detect if text content is RTL (Persian, Arabic, Hebrew, etc.)
 * by checking the first meaningful characters.
 */
export function detectRtl(text: string): boolean {
  if (!text) return false;
  const rtlRegex = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
  // Check first 100 chars for RTL characters
  return rtlRegex.test(text.slice(0, 100));
}
