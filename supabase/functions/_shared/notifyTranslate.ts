/**
 * notifyTranslate.ts — Shared translation utility for notification edge functions.
 * Translates notification title+body into a target language using the translate-message edge function.
 * Falls back to original English text on any error.
 */

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
 * Uses the existing translate-message edge function (gemini-2.5-flash-lite).
 * Returns the original English strings if translation fails for any reason.
 */
export async function translateNotification(
  supabaseUrl: string,
  anonKey: string,
  title: string,
  body: string,
  targetLang: string
): Promise<{ title: string; body: string }> {
  // Nothing to do for English
  if (targetLang === "en") return { title, body };

  try {
    const combined = title + "\n" + body;

    const res = await fetch(`${supabaseUrl}/functions/v1/translate-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        text: combined,
        sourceLang: "en",
        targetLangs: [targetLang],
      }),
    });

    if (!res.ok) {
      console.warn(`translateNotification: HTTP ${res.status} for lang=${targetLang}`);
      return { title, body };
    }

    const { translations } = await res.json();
    const translated: string | undefined = translations?.[targetLang];
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
