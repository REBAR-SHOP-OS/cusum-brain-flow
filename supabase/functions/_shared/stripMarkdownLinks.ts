// Convert markdown link syntax `[text](url)` → `text`.
// Prevents AI models from emitting auto-linked URLs in social captions
// (e.g. `[www.rebar.shop](http://www.rebar.shop)` rendering as raw markdown).
export function stripMarkdownLinks(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    // [text](url) → text
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|mailto:|tel:)?[^)]+\)/g, "$1")
    // <http://example.com> → http://example.com
    .replace(/<((?:https?:\/\/|mailto:|tel:)[^>]+)>/g, "$1");
}
