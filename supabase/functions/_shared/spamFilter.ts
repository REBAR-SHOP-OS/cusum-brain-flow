/**
 * Spam Filter — Detect spam SMS messages to prevent auto-replies and CEO alerts.
 * Used by ringcentral-webhook, ringcentral-sync, and vizzy-sms-reply.
 *
 * Returns structured analysis with reasons for centralized enforcement.
 */

const SPAM_KEYWORDS = [
  "pre-ipo", "bonus shares", "acquisition reveal",
  "join me on whatsapp", "let's chat on whatsapp", "chat on whatsapp", "whatsapp",
  "crypto", "bitcoin", "ethereum", "blockchain",
  "lottery", "you've won", "you have won", "congratulations you",
  "act now", "limited time offer", "click here", "unsubscribe", "opt out",
  "free money", "guaranteed return", "risk-free", "double your",
  "nigerian prince", "wire transfer", "western union",
  "viagra", "cialis", "pharmacy",
  "earn money fast", "work from home opportunity",
  "investment opportunity", "stock alert", "shares revealed",
  "text me on whatsapp", "message me on whatsapp", "reach me on whatsapp",
  "add me on whatsapp", "contact me on whatsapp",
  "telegram", "join my telegram",
];

const TOLL_FREE_PREFIXES = ["855", "888", "877", "866", "800", "844", "833"];

export interface SpamAnalysis {
  isSpam: boolean;
  reasons: string[];
  normalizedText: string;
}

/**
 * Normalize text for robust spam detection:
 * - lowercase
 * - collapse whitespace
 * - strip invisible/zero-width chars
 * - strip common unicode confusables (smart quotes, etc.)
 * - strip punctuation noise between letters
 */
function normalizeText(raw: string): string {
  let t = (raw || "").toLowerCase();

  // Remove zero-width chars, soft hyphens, RTL/LTR marks, BOM
  t = t.replace(/[\u200B-\u200F\u2028-\u202F\u2060\uFEFF\u00AD]/g, "");

  // Normalize smart quotes/apostrophes to ASCII
  t = t.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  t = t.replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  // Normalize common confusable letters (Cyrillic lookalikes, fullwidth, etc.)
  const confusables: Record<string, string> = {
    "\u0430": "a", "\u0435": "e", "\u043E": "o", "\u0440": "p",
    "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0456": "i",
    "\u0501": "d", "\uFF41": "a", "\uFF45": "e", "\uFF4F": "o",
  };
  for (const [from, to] of Object.entries(confusables)) {
    t = t.replaceAll(from, to);
  }

  // Collapse whitespace
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

/**
 * Structured spam analysis — returns reasons for logging/metadata.
 */
export function analyzeSpam(text: string, fromNumber: string): SpamAnalysis {
  const normalizedText = normalizeText(text);
  const reasons: string[] = [];
  const digits = (fromNumber || "").replace(/\D/g, "");

  // Toll-free / marketing numbers
  for (const prefix of TOLL_FREE_PREFIXES) {
    if (digits.startsWith(`1${prefix}`) || digits.startsWith(prefix)) {
      reasons.push(`toll_free_prefix:${prefix}`);
      break;
    }
  }

  // Short codes (5-6 digits) — marketing/automated
  if (digits.length >= 5 && digits.length <= 6) {
    reasons.push("short_code");
  }

  // Keyword blocklist (check against normalized text)
  for (const kw of SPAM_KEYWORDS) {
    if (normalizedText.includes(kw)) {
      reasons.push(`keyword:${kw}`);
      break; // one keyword match is sufficient
    }
  }

  // Also check with punctuation stripped for evasion attempts like "W.h.a.t.s.a.p.p"
  const stripped = normalizedText.replace(/[^a-z0-9 ]/g, "");
  if (!reasons.some(r => r.startsWith("keyword:"))) {
    for (const kw of SPAM_KEYWORDS) {
      const kwStripped = kw.replace(/[^a-z0-9 ]/g, "");
      if (stripped.includes(kwStripped)) {
        reasons.push(`keyword_stripped:${kw}`);
        break;
      }
    }
  }

  // URL-heavy messages (more than 2 URLs)
  const urlCount = (normalizedText.match(/https?:\/\//g) || []).length;
  if (urlCount > 2) {
    reasons.push(`excessive_urls:${urlCount}`);
  }

  return {
    isSpam: reasons.length > 0,
    reasons,
    normalizedText,
  };
}

/**
 * Backwards-compatible boolean wrapper.
 */
export function isSpamSms(text: string, fromNumber: string): boolean {
  return analyzeSpam(text, fromNumber).isSpam;
}
