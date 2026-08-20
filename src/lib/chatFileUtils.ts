import { supabase } from "@/integrations/supabase/client";



/** ~1 year — long-lived signed URL for chat attachments */
const CHAT_FILE_SIGNED_TTL = 60 * 60 * 24 * 365;

/**
 * Create a long-lived signed URL for a file in the (private) team-chat-files bucket.
 * Returns empty string on failure. Use this when persisting a URL into a chat message.
 */
export async function getChatFileSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("team-chat-files")
    .createSignedUrl(storagePath, CHAT_FILE_SIGNED_TTL);
  if (error || !data?.signedUrl) {
    console.warn("Failed to sign chat file URL", error);
    return "";
  }
  return data.signedUrl;
}


/**
 * Extract the storage path from any team-chat-files URL (signed, public,
 * authenticated, render path, or legacy variants). Returns null if the URL is
 * not a team-chat-files URL.
 */
export function extractChatFilePath(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/object\/(?:sign|public|authenticated|render\/[^/]+)\/team-chat-files\/([^?#]+)/);
  if (m?.[1]) {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }
  const loose = url.match(/\/team-chat-files\/([^?#]+)/);
  if (loose?.[1]) {
    try { return decodeURIComponent(loose[1]); } catch { return loose[1]; }
  }
  return null;
}

/**
 * Resolve any team-chat-files URL (legacy public, expired signed, etc.) to a
 * fresh signed URL. Returns the original URL if it's not a team-chat-files URL
 * or if signing fails.
 */
export async function resolveChatFileUrl(url: string): Promise<string> {
  const path = extractChatFilePath(url);
  if (!path) return url;
  const signed = await getChatFileSignedUrl(path);
  return signed || url;
}

/**
 * Legacy URL fixer. Bucket is now private — cannot return a public URL.
 * Returns the original URL (signed URLs already in messages will continue
 * to work until they expire; old `public/` URLs will be re-resolved on demand
 * by `resolveChatFileUrl`).
 */
export function fixChatFileUrl(url: string): string {
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

/**
 * Unified message content resolver.
 * Extracts attachments from BOTH the structured `attachments` array AND
 * legacy markdown links embedded in `original_text`.
 * Returns deduplicated attachments and clean visible text.
 * IMPORTANT: Always parses from original_text, never from translated text.
 */
export function resolveMessageContent(
  originalText: string,
  structuredAttachments?: Array<{ name: string; url: string; type?: string; size?: number }> | null,
): {
  cleanText: string;
  allAttachments: Array<{ name: string; url: string }>;
} {
  // 1. Parse legacy markdown attachments from original_text
  const { cleanText, parsedAttachments } = parseAttachmentLinks(originalText);

  // 2. Merge with structured attachments
  const merged = [
    ...parsedAttachments,
    ...(structuredAttachments || []).map((a) => ({ name: a.name, url: fixChatFileUrl(a.url) })),
  ];

  // 3. Deduplicate by URL
  const seen = new Set<string>();
  const allAttachments = merged.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  return { cleanText, allAttachments };
}
