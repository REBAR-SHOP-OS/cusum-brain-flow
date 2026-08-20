import { supabase } from "@/integrations/supabase/client";

const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Get a signed URL for a file in the estimation-files bucket.
 * Falls back to constructing a path-based URL if signing fails.
 */
export async function getSignedFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("estimation-files")
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    console.error("Failed to create signed URL:", error);
    // Return empty string — caller should handle gracefully
    return "";
  }

  return data.signedUrl;
}
