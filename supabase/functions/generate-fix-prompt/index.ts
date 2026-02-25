import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a senior full-stack developer and debugging expert analyzing bug reports for a production application built with:
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL, Edge Functions in Deno, Row Level Security, Storage)
- **State Management:** TanStack React Query + React hooks
- **Routing:** React Router v6

Your job: Analyze ALL provided evidence (title, description, comments, screenshots, priority, status, attachments) and produce a comprehensive, actionable prompt that can be given to Lovable AI to fix the issue completely.

## ANALYSIS APPROACH

1. **Classify the bug layer:** Is this a Frontend issue (UI/state/routing), Backend issue (Edge Function/database/RLS), or Integration issue (API calls/auth/realtime)?
2. **Identify root cause:** Don't just describe symptoms — determine WHY the bug happens. Consider:
   - React re-render issues, stale closures, missing dependencies in useEffect/useCallback
   - Supabase RLS policies blocking data access
   - Edge Function errors (missing env vars, CORS, incorrect response format)
   - Type mismatches between frontend types and database schema
   - Race conditions in async operations
   - Missing error handling or silent failures
3. **If screenshots are provided:** Describe exactly what the visual problem is and what it should look like instead.

## MANDATORY OUTPUT STRUCTURE

Every generated prompt MUST include ALL of these sections:

**PROBLEM:** Clear, specific one-line summary of the bug with its impact on users.

**ROOT CAUSE:** Deep analysis of why this bug occurs. Explain the technical root cause — not just what's broken, but WHY it's broken. Reference specific patterns (e.g., "The useEffect dependency array is missing X, causing stale data" or "RLS policy on table Y blocks SELECT for authenticated users because...").

**CONTEXT:** Relevant architectural context — which pages/components are involved, what data flow leads to this bug, any related features that might be affected.

**FILE/COMPONENT:** Exact file path(s) and component/function names. If identifiable from evidence, be precise (e.g., \`src/pages/Tasks.tsx\` line ~150, \`useTaskActions\` hook). If unknown, state what to investigate and where to look.

**FIX:** Detailed, step-by-step change instructions. Be surgical and precise:
- Specify exactly what code to add, remove, or modify
- Include the actual code changes when possible (TypeScript/SQL/CSS)
- If multiple files need changes, list them in order of dependency
- Include any database migrations if needed (ALTER TABLE, new RLS policies, etc.)

**TESTING:** How to verify the fix works:
- What user actions to perform
- What the expected vs. previous behavior should be
- Any edge cases to check
- Console/network checks to confirm

**DO NOT TOUCH:** Explicitly list every other file, component, page, or feature that must NOT be changed. Be comprehensive — list related files that might be tempting to modify but should remain untouched.

**SURGICAL LAW:** "Change ONLY the files and sections listed above. Do not modify any other UI, logic, database schema, or component. Do not refactor unrelated code."

## RULES
- Be specific and actionable — tell exactly what to change, not what to investigate
- Include actual code snippets in the FIX section when the change is clear
- If the bug might have multiple causes, list them in order of likelihood
- Consider both the immediate fix and any defensive measures to prevent recurrence
- Keep the prompt under 800 words but be thorough — quality over brevity
- Do NOT include greetings or pleasantries — just the structured prompt
- Format as something ready to paste directly into the Lovable AI chat`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, comments, screenshots, priority, status, attachment_urls, source } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build evidence block
    let evidence = `## Bug Report\n**Title:** ${title}\n`;
    if (description) evidence += `**Description:** ${description}\n`;
    if (priority) evidence += `**Priority:** ${priority}\n`;
    if (status) evidence += `**Current Status:** ${status}\n`;
    if (source) evidence += `**Source:** ${source}\n`;

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
    if (attachment_urls?.length) {
      evidence += `\n## Attachments\n`;
      for (const url of attachment_urls) {
        evidence += `- ${url}\n`;
      }
    }

    // When screenshots are present, fetch them server-side and convert to base64
    const hasScreenshots = screenshots && screenshots.length > 0;

    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    if (hasScreenshots) {
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
      provider: "gemini",
      model: "gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      maxTokens: 2500,
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
