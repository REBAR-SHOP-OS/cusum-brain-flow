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
 * Backwards-compatible synchronous helper. The team-chat-files bucket is private,
 * so this can no longer return a working public URL — callers should migrate to
 * `getChatFileSignedUrl`. Kept to avoid breaking imports; returns empty string.
 * @deprecated use getChatFileSignedUrl
 */
export function getPublicFileUrl(_storagePath: string): string {
  return "";
}

/**
 * Extract the storage path from a legacy public/signed team-chat-files URL.
 * Returns null if the URL is external or doesn't match.
 */
export function extractChatFilePath(url: string): string | null {
  if (!url) return null;
  const signed = url.match(/\/object\/sign\/team-chat-files\/([^?]+)/);
  if (signed?.[1]) return decodeURIComponent(signed[1]);
  const publicMatch = url.match(/\/object\/public\/team-chat-files\/([^?]+)/);
  if (publicMatch?.[1]) return decodeURIComponent(publicMatch[1]);
  return null;
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
 * Resolve any chat-file URL to a fresh signed URL (async).
 * If it's an external URL, returns as-is. If unparseable, returns original.
 */
export async function resolveChatFileUrl(url: string): Promise<string> {
  const path = extractChatFilePath(url);
  if (!path) return url;
  const fresh = await getChatFileSignedUrl(path);
  return fresh || url;
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
