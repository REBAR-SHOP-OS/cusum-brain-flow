import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EditAction =
  | "change-style"
  | "change-lighting"
  | "remove-object"
  | "replace-background"
  | "extend-clip"
  | "regenerate-section"
  | "custom";

const EDIT_SYSTEM_PROMPT = `You are a cinematic video prompt editor. You receive an original engineered video prompt and an edit instruction. Your job is to modify the prompt according to the instruction while preserving the core scene.

RULES:
1. Keep the same subject and general scene unless told to change it
2. Apply the requested modification precisely
3. Keep the result under 200 words
4. Write as a single flowing paragraph — NO bullet points
5. Output ONLY a JSON object: { "editedPrompt": "the modified prompt..." }`;

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
      parsed = { editedPrompt: content.trim() };
    }

    return new Response(
      JSON.stringify({
        editedPrompt: parsed.editedPrompt,
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
