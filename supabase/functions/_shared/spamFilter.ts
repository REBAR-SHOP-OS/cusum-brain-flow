/**
 * Spam Filter — Detect spam SMS messages to prevent auto-replies and CEO alerts.
 * Used by ringcentral-webhook, ringcentral-sync, and vizzy-sms-reply.
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
];

const TOLL_FREE_PREFIXES = ["855", "888", "877", "866", "800", "844", "833"];

export function isSpamSms(text: string, fromNumber: string): boolean {
  const lower = (text || "").toLowerCase();
  const digits = (fromNumber || "").replace(/\D/g, "");

  // Toll-free / marketing numbers
  for (const prefix of TOLL_FREE_PREFIXES) {
    if (digits.startsWith(`1${prefix}`) || digits.startsWith(prefix)) {
      return true;
    }
  }

  // Short codes (5-6 digits) — marketing/automated
  if (digits.length >= 5 && digits.length <= 6) {
    return true;
  }

  // Keyword blocklist
  if (SPAM_KEYWORDS.some(kw => lower.includes(kw))) {
    return true;
  }

  // URL-heavy messages (more than 2 URLs)
  const urlCount = (lower.match(/https?:\/\//g) || []).length;
  if (urlCount > 2) {
    return true;
  }

  return false;
}
