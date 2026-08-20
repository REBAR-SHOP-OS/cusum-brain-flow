import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompressor";

type UploadOptions = {
  contentType?: string;
  upsert?: boolean;
};

/**
 * Drop-in replacement for supabase.storage.from(bucket).upload(path, file, opts).
 * Automatically compresses image files before uploading (≤2048px, JPEG 80%).
 * Non-image files and Blobs without a type pass through unchanged.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  fileOrBlob: File | Blob,
  opts?: UploadOptions
) {
  let payload: File | Blob = fileOrBlob;

  // Only compress File objects that are images
  if (fileOrBlob instanceof File && fileOrBlob.type.startsWith("image/")) {
    try {
      payload = await compressImage(fileOrBlob);
    } catch (err) {
      console.warn("[storageUpload] compression failed, uploading original", err);
    }
  }

  return supabase.storage.from(bucket).upload(path, payload, {
    contentType: opts?.contentType ?? (payload instanceof File ? payload.type : undefined),
    upsert: opts?.upsert ?? false,
  });
}
