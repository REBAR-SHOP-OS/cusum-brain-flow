import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 3) {
      return new Response(
        JSON.stringify({ corrected: text || "", changed: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Fix grammar, spelling, punctuation, and clarity. Do NOT change meaning, tone, or intent. If the text is already correct, return it unchanged. Return ONLY the corrected text, no explanation, no quotes.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      maxTokens: 500,
      temperature: 0.2,
    });

    const corrected = result.content.trim();
    const changed = corrected !== text.trim();

    return new Response(
      JSON.stringify({ corrected: changed ? corrected : text, changed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("grammar-check error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
