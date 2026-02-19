import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior full-stack developer analyzing bug reports for a Lovable AI-built React/TypeScript/Supabase application.

Your job: read ALL the evidence (title, description, comments, screenshot URLs) and produce a single, clear, copy-pasteable prompt that a user can give to Lovable AI to fix the issue.

Rules:
- Start the prompt with a one-line summary of what's wrong.
- If you can identify the likely file(s) or component(s) from the evidence, mention them.
- Be specific and surgical — tell Lovable AI exactly what to change.
- If screenshots are provided, reference what they show.
- Keep the prompt under 300 words.
- Do NOT include greetings or pleasantries — just the instruction.
- Format the prompt as something ready to paste directly into the Lovable AI chat.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, comments, screenshots } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build evidence block
    let evidence = `## Bug Report\n**Title:** ${title}\n`;
    if (description) evidence += `**Description:** ${description}\n`;
    if (comments?.length) {
      evidence += `\n## Comments & Evidence\n`;
      for (const c of comments) {
        evidence += `- ${c}\n`;
      }
    }
    if (screenshots?.length) {
      evidence += `\n## Screenshots\n`;
      for (const url of screenshots) {
        evidence += `- ${url}\n`;
      }
    }

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: evidence },
      ],
      temperature: 0.3,
      maxTokens: 1000,
      fallback: { provider: "gemini", model: "gemini-2.5-flash" },
    });

    return new Response(JSON.stringify({ prompt: result.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-fix-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
