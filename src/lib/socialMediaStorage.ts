import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";
import { normalizeForInstagram } from "@/lib/igSafeVideo";

const BUCKET = "social-media-assets";

/**
 * Pick a truthful file extension from the blob's actual MIME type.
 * Returning the wrong extension (e.g. `.mp4` for a WebM blob) is what
 * caused Instagram publishes to fail with "not Instagram-ready" — Meta
 * inspects the bytes, not the filename.
 */
function extensionForBlob(blob: Blob, type: "image" | "video"): string {
  const mime = (blob.type || "").toLowerCase();
  if (type === "video") {
    if (mime.includes("webm")) return "webm";
    if (mime.includes("quicktime") || mime.includes("mov")) return "mov";
    if (mime.includes("matroska")) return "mkv";
    if (mime.includes("mp4") || mime.includes("h264") || mime === "" /* unknown → assume mp4 */) return "mp4";
    return "mp4";
  }
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

async function normalizeForInstagramUpload(blob: Blob): Promise<ReturnType<typeof normalizeForInstagram>> {
  const NORMALIZE_TIMEOUT_MS = 45_000;
  return await Promise.race([
    normalizeForInstagram(blob),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("normalize_timeout")), NORMALIZE_TIMEOUT_MS),
    ),
  ]);
}

/**
 * Uploads a generated image or video to Supabase storage and returns a permanent public URL.
 * Handles data: URIs (base64), blob: URIs, and remote https: URLs.
 *
 * IMPORTANT: the saved filename extension and contentType reflect the blob's
 * real MIME type. Do not coerce arbitrary video blobs to `.mp4` — Instagram
 * rejects mis-labelled WebM/VP9 files at publish time.
 */
export async function uploadSocialMediaAsset(
  sourceUrl: string,
  type: "image" | "video"
): Promise<string> {
  let blob: Blob;

  if (sourceUrl.startsWith("data:")) {
    const resp = await fetch(sourceUrl);
    blob = await resp.blob();
  } else if (sourceUrl.startsWith("blob:")) {
    const resp = await fetch(sourceUrl);
    blob = await resp.blob();
  } else {
    const resp = await fetch(sourceUrl);
    if (!resp.ok) throw new Error("Failed to fetch remote media");
    blob = await resp.blob();
  }

  // Root-cause fix for Instagram "rejected during processing": browser
  // MediaRecorder produces MP4s with ~1000 fps timestamps and 30+ Mbps
  // bitrate that violate IG Reels limits. Normalize every social video to
  // a safe spec at upload time so it's IG-ready for every platform.
  if (type === "video") {
    try {
      // Hard timeout so a stuck encoder (e.g. unseekable WebM) never freezes
      // the "Uploading media…" overlay forever.
      const norm = await normalizeForInstagramUpload(blob);
      if (norm.reencoded) {
        console.log("[socialMediaStorage] video normalized to IG-safe MP4");
        blob = norm.blob;
      }
    } catch (e) {
      console.warn("[socialMediaStorage] IG-safe normalization failed, uploading original", e);
    }
  }


  const ext = extensionForBlob(blob, type);
  const fileName = `${type}s/${crypto.randomUUID()}.${ext}`;
  const contentType =
    blob.type ||
    (type === "video" ? "video/mp4" : "image/png");

  const { error } = await uploadToStorage(BUCKET, fileName, blob, {
    contentType,
    upsert: false,
  });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload ${type}: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}
