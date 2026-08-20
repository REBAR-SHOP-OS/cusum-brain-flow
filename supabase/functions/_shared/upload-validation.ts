/**
 * Shared upload validation utilities for edge functions.
 * Enforces file extension allowlists, size limits, and content-type validation.
 */

/** Maximum upload size: 50 MB */
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;

/** Allowed file extensions by category */
export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".rtf"],
  drawings: [".dwg", ".dxf", ".dgn"],
  images: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".svg"],
  archives: [".zip", ".rar", ".7z", ".tar", ".gz"],
};

/** All allowed extensions (flat list) */
export const ALL_ALLOWED_EXTENSIONS = Object.values(ALLOWED_EXTENSIONS).flat();

/** Magic byte signatures for common file types */
const FILE_SIGNATURES: Array<{ ext: string[]; bytes: number[]; offset?: number }> = [
  { ext: [".pdf"], bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: [".png"], bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: [".jpg", ".jpeg"], bytes: [0xff, 0xd8, 0xff] },
  { ext: [".gif"], bytes: [0x47, 0x49, 0x46] },
  { ext: [".zip", ".xlsx", ".docx"], bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK
  { ext: [".rar"], bytes: [0x52, 0x61, 0x72, 0x21] }, // Rar!
  { ext: [".bmp"], bytes: [0x42, 0x4d] },
  { ext: [".tiff", ".tif"], bytes: [0x49, 0x49, 0x2a, 0x00] }, // little-endian
  { ext: [".webp"], bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a file upload against security constraints.
 * @param filename - Original filename
 * @param sizeBytes - File size in bytes
 * @param contentType - MIME content-type header (optional)
 * @param fileBytes - First few bytes of file for signature check (optional)
 * @param allowedCategories - Which extension categories to allow (default: all)
 */
export function validateUpload(
  filename: string,
  sizeBytes: number,
  contentType?: string,
  fileBytes?: Uint8Array,
  allowedCategories?: string[],
): ValidationResult {
  // 1. Size check
  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB limit`,
    };
  }

  // 2. Extension allowlist
  const ext = getExtension(filename);
  const allowedExts = allowedCategories
    ? allowedCategories.flatMap((cat) => ALLOWED_EXTENSIONS[cat] || [])
    : ALL_ALLOWED_EXTENSIONS;

  if (!ext || !allowedExts.includes(ext)) {
    return {
      valid: false,
      error: `File extension "${ext || "(none)"}" is not allowed. Allowed: ${allowedExts.join(", ")}`,
    };
  }

  // 3. Content-type vs extension consistency (basic check)
  if (contentType) {
    const suspicious = isContentTypeSuspicious(ext, contentType);
    if (suspicious) {
      return {
        valid: false,
        error: `Content-Type "${contentType}" does not match file extension "${ext}"`,
      };
    }
  }

  // 4. Magic bytes validation (if provided)
  if (fileBytes && fileBytes.length >= 8) {
    const signatureMatch = checkFileSignature(ext, fileBytes);
    if (signatureMatch === false) {
      return {
        valid: false,
        error: `File content does not match expected signature for "${ext}"`,
      };
    }
  }

  return { valid: true };
}

function getExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return null;
  return filename.substring(lastDot).toLowerCase();
}

function isContentTypeSuspicious(ext: string, contentType: string): boolean {
  const ct = contentType.toLowerCase();
  // Block executable/script content types regardless of extension
  const dangerousTypes = [
    "application/x-executable",
    "application/x-msdos-program",
    "text/html",
    "application/javascript",
    "text/javascript",
    "application/x-sh",
    "application/x-csh",
  ];
  if (dangerousTypes.includes(ct)) return true;

  // Check basic mismatch for known types
  if (ext === ".pdf" && !ct.includes("pdf") && !ct.includes("octet-stream")) return true;
  if ((ext === ".jpg" || ext === ".jpeg") && !ct.includes("jpeg") && !ct.includes("image") && !ct.includes("octet-stream")) return true;
  if (ext === ".png" && !ct.includes("png") && !ct.includes("image") && !ct.includes("octet-stream")) return true;

  return false;
}

function checkFileSignature(ext: string, bytes: Uint8Array): boolean | null {
  // Find expected signatures for this extension
  const expectedSigs = FILE_SIGNATURES.filter((s) => s.ext.includes(ext));
  if (expectedSigs.length === 0) return null; // No signature to check

  // Check if any signature matches
  return expectedSigs.some((sig) => {
    const offset = sig.offset ?? 0;
    if (bytes.length < offset + sig.bytes.length) return false;
    return sig.bytes.every((b, i) => bytes[offset + i] === b);
  });
}
