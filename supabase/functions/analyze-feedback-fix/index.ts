import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior full-stack developer and debugging expert analyzing employee feedback/bug reports for a production ERP application built with:
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL, Edge Functions in Deno, Row Level Security, Storage)
- **State Management:** TanStack React Query + React hooks
- **Routing:** React Router v6

Your job: Analyze ALL provided evidence (title, description, screenshots, page context, reopen reasons) and produce a comprehensive, actionable prompt that can be given to Lovable AI to fix the issue completely.

## ANALYSIS APPROACH

1. **Classify the bug layer:** Frontend (UI/state/routing), Backend (Edge Function/database/RLS), or Integration (API calls/auth/realtime)?
2. **Identify root cause:** Don't just describe symptoms — determine WHY the bug happens.
3. **If screenshots are provided:** Describe exactly what the visual problem is and what it should look like instead.
4. **Consider employee perspective:** The reporter is a non-technical user — read between the lines of their description.

## MANDATORY OUTPUT FORMAT

Your entire response must be a single LOVABLE COMMAND block in this exact format:

\`\`\`
LOVABLE COMMAND:
Fix the [component/feature] [bug type]

PROBLEM: [Clear one-line summary]

ROOT CAUSE: [Technical analysis of why this happens]

CONTEXT: [Which pages/components are involved, data flow]

FILE: [Primary file path to modify, e.g. src/pages/Tasks.tsx]

FIX: [Detailed step-by-step instructions with code changes]

TESTING: [How to verify the fix works]

DO NOT TOUCH: [Files that must not be changed]

SURGICAL LAW: Change ONLY the files and sections listed above.
\`\`\`

## RULES
- Output ONLY the LOVABLE COMMAND block — no other text before or after
- Be specific and actionable — provide exact code changes
- Include actual TypeScript/SQL code snippets in the FIX section
- Keep under 800 words but be thorough
- The output will be copy-pasted directly into Lovable AI chat`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, screenshot_url, page_path, reopen_reason, original_task_id } = await req.json();

    if (!title && !description) {
      return new Response(JSON.stringify({ error: "Title or description required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build evidence
    let evidence = `## Employee Feedback Report\n**Title:** ${title || "No title"}\n`;
    if (description) evidence += `**Description:** ${description}\n`;
    if (page_path) evidence += `**Page:** ${page_path}\n`;
    if (reopen_reason) evidence += `\n## Reopen Reason (issue persists)\n${reopen_reason}\n`;

    // Handle screenshot
    const imageBlocks: Array<{ type: string; image_url?: { url: string } }> = [];
    if (screenshot_url) {
      evidence += `**Screenshot:** ${screenshot_url}\n`;
      try {
        const imgResp = await fetch(screenshot_url);
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
        console.warn("Failed to fetch screenshot:", screenshot_url, imgErr);
      }
    }

    const userContent = imageBlocks.length > 0
      ? [{ type: "text", text: evidence }, ...imageBlocks]
      : evidence;

    // Call AI
    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-pro",
      agentName: "feedback-analyzer",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      maxTokens: 2500,
      fallback: { provider: "gemini", model: "gemini-2.5-flash" },
    });

    const generatedPrompt = result.content;

    // Save to vizzy_memory
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    await supabaseAdmin.from("vizzy_memory").insert({
      category: "feedback_fix",
      content: generatedPrompt,
      metadata: {
        source_title: title,
        source_description: description?.slice(0, 500),
        screenshot_url,
        page_path,
        reopen_reason: reopen_reason || null,
        original_task_id: original_task_id || null,
        generated_at: new Date().toISOString(),
        applied: false,
      },
    });

    // If there's an original task, mark it as system_processing
    if (original_task_id) {
      await supabaseAdmin.from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", original_task_id);
    }

    return new Response(JSON.stringify({ success: true, prompt: generatedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-feedback-fix error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
