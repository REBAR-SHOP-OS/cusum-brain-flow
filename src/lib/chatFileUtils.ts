import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Get a permanent public URL for a file in the team-chat-files bucket.
 */
export function getPublicFileUrl(storagePath: string): string {
  const { data } = supabase.storage.from("team-chat-files").getPublicUrl(storagePath);
  return data?.publicUrl || "";
}

/**
 * Fix a potentially expired signed URL by converting it to a public URL.
 * If the URL is already a public URL or external, returns it as-is.
 */
export function fixChatFileUrl(url: string): string {
  if (!url) return url;

  // Detect signed URL pattern from our Supabase storage
  if (url.includes("/storage/v1/") && url.includes("token=")) {
    // Extract the path after /object/sign/team-chat-files/
    const match = url.match(/\/object\/sign\/team-chat-files\/([^?]+)/);
    if (match?.[1]) {
      return `${SUPABASE_URL}/storage/v1/object/public/team-chat-files/${decodeURIComponent(match[1])}`;
    }
  }

  // Detect already-public URL pattern — leave as-is
  if (url.includes("/object/public/team-chat-files/")) {
    return url;
  }

  return url;
}

/**
 * Check if a MIME type or filename represents an image.
 */
export function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
}

/**
 * Parse markdown-style attachment links from original_text.
 * Pattern: 📎 [filename](url)
 */
export function parseAttachmentLinks(text: string): { cleanText: string; parsedAttachments: { name: string; url: string }[] } {
  const regex = /📎\s*\[([^\]]+)\]\(([^)]+)\)/g;
  const parsedAttachments: { name: string; url: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    parsedAttachments.push({ name: match[1], url: fixChatFileUrl(match[2]) });
  }
  const cleanText = text.replace(regex, "").trim();
  return { cleanText, parsedAttachments };
}
