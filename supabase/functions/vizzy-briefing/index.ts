import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";
import { json } from "../_shared/auth.ts";

/**
 * Uses Gemini to compress the massive Vizzy business context
 * into a concise, intelligent briefing for the AI assistant.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { rawContext } = body;
    if (!rawContext || typeof rawContext !== "string") {
      throw json({ error: "rawContext string is required" }, 400);
    }

    try {
      const result = await callAI({
        provider: "gemini",
        model: "gemini-2.5-flash",
        agentName: "vizzy",
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
          { role: "user", content: rawContext },
        ],
      });

      return { briefing: result.content || rawContext };
    } catch (aiErr: any) {
      // Fallback: return raw context on any AI error
      console.warn("AI error, returning raw context:", aiErr.message);
      return { briefing: rawContext };
    }
  }, { functionName: "vizzy-briefing", requireCompany: false, wrapResult: false }),
);
