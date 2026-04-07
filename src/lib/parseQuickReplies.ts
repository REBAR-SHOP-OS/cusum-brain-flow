/**
 * Extracts [QUICK_REPLIES] block from Vizzy's response.
 * Returns cleaned content and an array of reply strings.
 */
export function parseQuickReplies(text: string): { content: string; replies: string[] } {
  const regex = /\[QUICK_REPLIES\]([\s\S]*?)\[\/QUICK_REPLIES\]/;
  const match = text.match(regex);

  if (!match) {
    return { content: text, replies: [] };
  }

  const content = text.replace(regex, "").trimEnd();
  const raw = match[1];
  const replies = raw
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);

  return { content, replies };
}
