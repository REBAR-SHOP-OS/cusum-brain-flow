import { supabase } from "@/integrations/supabase/client";

const BUCKET = "social-media-assets";

/**
 * Uploads a generated image or video to Supabase storage and returns a permanent public URL.
 * Handles data: URIs (base64), blob: URIs, and remote https: URLs.
 */
export async function uploadSocialMediaAsset(
  sourceUrl: string,
  type: "image" | "video"
): Promise<string> {
  let blob: Blob;

  if (sourceUrl.startsWith("data:")) {
    // base64 data URI → blob
    const resp = await fetch(sourceUrl);
    blob = await resp.blob();
  } else if (sourceUrl.startsWith("blob:")) {
    // blob URL (e.g. from Sora download proxy)
    const resp = await fetch(sourceUrl);
    blob = await resp.blob();
  } else {
    // remote URL (e.g. OpenAI temporary URL) → fetch via proxy to avoid CORS
    const resp = await fetch(sourceUrl);
    if (!resp.ok) throw new Error("Failed to fetch remote media");
    blob = await resp.blob();
  }

  const ext = type === "video" ? "mp4" : (blob.type.includes("png") ? "png" : "jpg");
  const fileName = `${type}s/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, blob, {
      contentType: blob.type || (type === "video" ? "video/mp4" : "image/png"),
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
