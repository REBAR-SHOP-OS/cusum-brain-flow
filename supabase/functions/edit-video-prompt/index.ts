import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

type EditAction =
  | "change-style"
  | "change-lighting"
  | "remove-object"
  | "replace-background"
  | "extend-clip"
  | "regenerate-section"
  | "custom";

const EDIT_SYSTEM_PROMPT = `You are a cinematic video prompt editor with TWO modes of operation.

STEP 1 — INTENT CLASSIFICATION:
Determine if the user's edit is an OVERLAY edit or a GENERATIVE edit.

OVERLAY edits are non-destructive additions placed ON TOP of the existing video:
- Adding a logo, watermark, sticker, or icon to something in the scene
- Adding text labels, titles, captions
- "Put logo on X", "add text saying Y", "overlay the brand mark"
- "Animated logo", "logo animation", "create logo", "logo intro", "brand intro animation", "add brand logo"
- ANY request that mentions "logo" is ALWAYS an overlay — unless the user explicitly asks to change the background video content itself

GENERATIVE edits require creating a new video:
- Changing lighting, style, mood, camera angle
- Removing objects, replacing backgrounds
- Changing the action, subject, or environment
- Any edit that modifies what the video model must render

STEP 2 — RESPOND:

If OVERLAY: output ONLY this JSON:
{ "type": "overlay", "overlay": { "kind": "logo" | "text", "position": "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center", "size": "small" | "medium" | "large", "content": "the text content or 'brand_logo' for logo", "animated": true | false } }

Set "animated" to true when the user requests animation, motion, fade-in, reveal, shimmer, or any dynamic effect on the overlay.

If GENERATIVE: output ONLY this JSON:
{ "type": "generative", "editedPrompt": "the modified prompt as a single paragraph under 200 words" }

RULES:
1. Keep the same subject and general scene unless told to change it
2. Apply the requested modification precisely
3. For generative edits, keep the result under 200 words, single paragraph, NO bullet points
4. NEVER output anything except the JSON object
5. When in doubt about logo requests, ALWAYS classify as overlay`;

const EDIT_ACTION_INSTRUCTIONS: Record<EditAction, string> = {
  "change-style": "Change the visual style of this video while keeping the same subject and scene. New style: ",
  "change-lighting": "Change only the lighting and mood of this video. New lighting: ",
  "remove-object": "Modify the prompt to exclude/remove this element from the scene: ",
  "replace-background": "Keep the main subject but change the environment/background to: ",
  "extend-clip": "Create a natural continuation of this scene that would follow seamlessly. The extended section should: ",
  "regenerate-section": "Regenerate this scene with the following modification: ",
  "custom": "",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { originalPrompt, editAction, editDetail } = await req.json();
    if (!originalPrompt || !editAction) {
      return new Response(
        JSON.stringify({ error: "originalPrompt and editAction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instruction = (EDIT_ACTION_INSTRUCTIONS[editAction as EditAction] || "") + (editDetail || "");
    const userMessage = `Original prompt:\n"${originalPrompt}"\n\nEdit instruction:\n${instruction}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EDIT_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Prompt editing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: treat as generative edit
      parsed = { type: "generative", editedPrompt: content.trim() };
    }

    // Route based on intent type
    if (parsed.type === "overlay" && parsed.overlay) {
      return new Response(
        JSON.stringify({ type: "overlay", overlay: parsed.overlay }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        type: "generative",
        editedPrompt: parsed.editedPrompt || content.trim(),
        editAction,
        editDetail,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("edit-video-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
