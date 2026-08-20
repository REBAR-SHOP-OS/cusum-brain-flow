/**
 * chunkText — splits text into short sentence groups for chunked TTS.
 *
 * Rules:
 * - Strip [VIZZY-ACTION]…[/VIZZY-ACTION] blocks first
 * - Split on sentence-ending punctuation (. ! ?)
 * - Group into chunks of ~120 characters (1–2 sentences)
 * - Never return empty chunks
 */

const ACTION_BLOCK_RE = /\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/g;
const SENTENCE_RE = /([^.!?]*[.!?])/g;

export function chunkText(raw: string, maxChars = 120): string[] {
  // Strip action blocks and [UNCLEAR]
  const cleaned = raw
    .replace(ACTION_BLOCK_RE, "")
    .replace(/\[UNCLEAR\]/g, "")
    .trim();

  if (!cleaned) return [];

  // Split into sentences
  const sentences: string[] = [];
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = SENTENCE_RE.exec(cleaned)) !== null) {
    sentences.push(match[1].trim());
    lastIndex = SENTENCE_RE.lastIndex;
  }

  // Remaining text after last sentence boundary
  const remainder = cleaned.slice(lastIndex).trim();
  if (remainder) sentences.push(remainder);

  if (sentences.length === 0) return [cleaned];

  // Group sentences into chunks of ~maxChars
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence) continue;
    if (current && (current.length + sentence.length + 1) > maxChars) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}
