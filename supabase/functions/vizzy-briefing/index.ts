import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

/**
 * Uses Gemini to compress the massive Vizzy business context
 * into a concise, intelligent briefing for the AI assistant.
 * Gemini chosen here: large context input (4000+ words) is its strength.
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

    try {
      const result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
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
      });

      return json({ briefing: result.content || rawContext });
    } catch (aiErr: any) {
      // Fallback: return raw context on any AI error
      console.warn("AI error, returning raw context:", aiErr.message);
      return json({ briefing: rawContext });
    }
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("vizzy-briefing error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
