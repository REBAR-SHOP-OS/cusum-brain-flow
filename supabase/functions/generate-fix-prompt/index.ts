import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior full-stack developer analyzing bug reports for a Lovable AI-built React/TypeScript/Supabase application.

Your job: read ALL the evidence (title, description, comments, screenshot URLs/images) and produce a single, clear, copy-pasteable prompt that a user can give to Lovable AI to fix the issue.

MANDATORY: Every generated prompt MUST be structured with these exact sections:

**PROBLEM:** One-line summary of the bug.
**FILE/COMPONENT:** Exact file path(s) or component name(s) if identifiable from the evidence. If unknown, state "Unknown — investigate logs."
**FIX:** Surgical, step-by-step change instructions. Be precise — specify what to add, remove, or change.
**DO NOT TOUCH:** Explicitly list every other file, component, page, or feature that must NOT be changed.
**SURGICAL LAW:** "Change ONLY the section listed above. Do not modify any other UI, logic, database, or component."

Additional rules:
- If screenshots are provided and you can see them, describe exactly what the visual problem is.
- Be specific and surgical — tell Lovable AI exactly what to change, not what to investigate.
- Keep the prompt under 400 words.
- Do NOT include greetings or pleasantries — just the structured prompt.
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

    // When screenshots are present, fetch them server-side and convert to base64
    // (GPT-4o vision cannot access authenticated Supabase storage URLs directly)
    const hasScreenshots = screenshots && screenshots.length > 0;

    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    if (hasScreenshots) {
      // Fetch each screenshot and convert to base64 data URL
      const imageBlocks: Array<{ type: string; image_url?: { url: string } }> = [];
      for (const url of screenshots) {
        try {
          const imgResp = await fetch(url);
          if (imgResp.ok) {
            const arrayBuffer = await imgResp.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            const contentType = imgResp.headers.get("content-type") || "image/png";
            imageBlocks.push({
              type: "image_url",
              image_url: { url: `data:${contentType};base64,${base64}` },
            });
          }
        } catch (imgErr) {
          console.warn("Failed to fetch screenshot:", url, imgErr);
        }
      }

      userContent = [
        { type: "text", text: evidence },
        ...imageBlocks,
      ];
    } else {
      userContent = evidence;
    }

    const result = await callAI({
      provider: "gpt",
      model: hasScreenshots ? "gpt-4o" : "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      maxTokens: 1200,
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
