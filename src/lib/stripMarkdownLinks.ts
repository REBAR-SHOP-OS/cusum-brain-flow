// Convert markdown link syntax `[text](url)` → `text`.
// Mirrors supabase/functions/_shared/stripMarkdownLinks.ts for frontend use.
export function stripMarkdownLinks(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:|tel:)?[^)]+\)/g, "$1")
    .replace(/<((?:https?:\/\/|mailto:|tel:)[^>]+)>/g, "$1");
}
