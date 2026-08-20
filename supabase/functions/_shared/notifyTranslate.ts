/**
 * notifyTranslate.ts — Shared translation utility for notification edge functions.
 * Translates notification title+body into a target language using callAI() directly.
 * Falls back to original English text on any error.
 */

import { callAI } from "./aiRouter.ts";

/**
 * Group an array of profile objects by their preferred_language.
 * Profiles without a language default to "en".
 */
export function groupByLanguage<T extends { preferred_language?: string | null }>(
  profiles: T[]
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const p of profiles) {
    const lang = p.preferred_language || "en";
    if (!groups[lang]) groups[lang] = [];
    groups[lang].push(p);
  }
  return groups;
}

/**
 * Translate a notification title and body into the target language.
 * Calls Gemini directly via callAI() — no auth dependency on translate-message.
 * Returns the original English strings if translation fails for any reason.
 */
export async function translateNotification(
  _supabaseUrl: string,
  _anonKey: string,
  title: string,
  body: string,
  targetLang: string
): Promise<{ title: string; body: string }> {
  // Nothing to do for English
  if (targetLang === "en") return { title, body };

  try {
    const combined = title + "\n" + body;

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `You are a translation engine. Translate the following text into ${targetLang}. Return ONLY the translated text, preserving the exact same line structure (first line = title, remaining lines = body). Do not add any explanations or extra content.`,
        },
        { role: "user", content: combined },
      ],
      temperature: 0.1,
      maxTokens: 500,
    });

    const translated = result.content?.trim();
    if (!translated) return { title, body };

    const parts = translated.split("\n");
    const localTitle = parts[0]?.trim() || title;
    const localBody = parts.slice(1).join("\n").trim() || body;

    return { title: localTitle, body: localBody };
  } catch (err) {
    console.warn("translateNotification: failed, using English fallback:", err);
    return { title, body };
  }
}

