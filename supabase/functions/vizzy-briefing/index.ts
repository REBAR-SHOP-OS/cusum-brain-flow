import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

/**
 * Uses Gemini 3 Pro to compress the massive Vizzy business context
 * into a concise, intelligent briefing — faster for ElevenLabs to process.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req);

    const { rawContext } = await req.json();
    if (!rawContext || typeof rawContext !== "string") {
      return json({ error: "rawContext string is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Fallback: return raw context if no API key
      console.warn("LOVABLE_API_KEY not set, returning raw context");
      return json({ briefing: rawContext });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          {
            role: "system",
            content: `You are a context compressor for an AI voice assistant called Vizzy. 
Your job is to take a large business data snapshot and compress it into a concise briefing that preserves ALL critical data points but removes redundancy and verbose formatting.

RULES:
- Keep ALL numbers, names, dates, and financial figures EXACTLY as-is
- Keep the role/personality instructions (first paragraph about who Vizzy is)
- Keep ALL tool definitions and instructions
- Compress the data sections: remove empty categories, combine related items
- Keep email subjects/senders but shorten previews
- Keep team directory and presence data
- Output must be under 2000 words (original is ~4000+)
- Do NOT add commentary — just output the compressed context
- Maintain the same instruction format so the voice agent understands its role`,
          },
          {
            role: "user",
            content: rawContext,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        console.warn("Gemini rate limited, returning raw context");
        return json({ briefing: rawContext });
      }
      console.error("Gemini error:", response.status);
      return json({ briefing: rawContext });
    }

    const data = await response.json();
    const briefing = data.choices?.[0]?.message?.content || rawContext;

    return json({ briefing });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("vizzy-briefing error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
