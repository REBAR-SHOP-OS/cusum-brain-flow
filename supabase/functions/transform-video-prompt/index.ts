import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

const CONSTRUCTION_KEYWORDS = [
  "rebar", "steel", "fabrication", "machine", "cage", "construction",
  "concrete", "pour", "crane", "scaffold", "welding", "cutting",
  "bending", "formwork", "site", "building", "foundation", "beam",
  "column", "slab", "reinforcement", "bar", "mesh", "stirrup",
  "factory", "plant", "shop", "yard", "warehouse", "industrial",
];

const CONSTRUCTION_ENHANCEMENTS = [
  "ultra realistic industrial textures",
  "fine dust particles floating in dramatic lighting",
  "metallic surface reflections and sparks",
  "heavy machinery with precise mechanical detail",
  "construction documentary cinematography",
  "hard hat workers in safety gear",
  "raw steel and concrete material close-ups",
  "volumetric light through factory windows",
];

const SYSTEM_PROMPT = `You are an expert cinematic video prompt engineer. Your job is to transform casual, simple user descriptions into rich, detailed, cinematic video generation prompts optimized for AI video models (Google Veo, OpenAI Sora).

RULES:
1. Extract and enhance these visual elements from the user's raw text:
   - SUBJECT: The main focus of the scene
   - ENVIRONMENT: Where the scene takes place
   - ACTION: What is happening, movement, dynamics
   - CAMERA: Camera movement (drone, tracking, close-up, dolly, crane, handheld, steadicam)
   - LIGHTING: Time of day, light quality, mood (golden hour, dramatic, industrial, neon)
   - STYLE: Visual style (cinematic, documentary, commercial, editorial, moody)
   - REALISM: Level of photorealism desired

2. CLASSIFY the user's intent into exactly one of these categories:
   - product_promo
   - cinematic_broll
   - industrial_machinery
   - construction_documentary
   - social_media_ad
   - educational_explainer
   - product_showcase
   - before_after
   - image_to_video

3. DETECT the target platform intent (if apparent):
   - instagram_reels
   - tiktok
   - youtube
   - linkedin
   - facebook
   - website_hero
   - general

4. REMOVE all marketing buzzwords, sales language, and non-visual fluff
5. ADD cinematic specificity: lens type feelings, depth of field, color grading notes
6. Keep the prompt under 200 words
7. Write as a single flowing paragraph — NO bullet points, NO labels
8. The output should read like a film director's shot description
9. CRITICAL: NEVER include any text, words, letters, typography, titles, captions, subtitles, brand names, or written content in the prompt. The video must be purely visual — zero text rendered in any frame.

RESPOND WITH ONLY A JSON OBJECT in this exact format:
{
  "engineeredPrompt": "The full cinematic prompt...",
  "elements": {
    "subject": "extracted subject",
    "environment": "extracted environment",
    "action": "extracted action",
    "camera": "suggested camera movement",
    "lighting": "suggested lighting",
    "style": "suggested style",
    "realism": "photorealistic|stylized|hyperreal"
  },
  "intent": "one of the intent categories above",
  "platform_intent": "one of the platform intent categories above",
  "isConstructionRelated": true|false
}`;

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { body } = ctx;
    const { rawPrompt, aspectRatio, duration } = body;
    if (!rawPrompt || typeof rawPrompt !== "string" || rawPrompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "rawPrompt is required" }),
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

    const lowerPrompt = rawPrompt.toLowerCase();
    const isConstructionRelated = CONSTRUCTION_KEYWORDS.some(kw => lowerPrompt.includes(kw));

    let userMessage = `Transform this casual video description into a cinematic prompt:\n\n"${rawPrompt}"`;
    if (aspectRatio) userMessage += `\n\nTarget aspect ratio: ${aspectRatio}`;
    if (duration) userMessage += `\nTarget duration: ${duration} seconds`;
    if (isConstructionRelated) {
      const enhancements = CONSTRUCTION_ENHANCEMENTS.slice(0, 4).join(", ");
      userMessage += `\n\nThis is construction/industrial content. Enhance with: ${enhancements}`;
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Prompt transformation failed" }),
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
      parsed = {
        engineeredPrompt: content.trim(),
        elements: {
          subject: rawPrompt,
          environment: "unspecified",
          action: "unspecified",
          camera: "cinematic",
          lighting: "dramatic",
          style: "cinematic",
          realism: "photorealistic",
        },
        intent: "cinematic_broll",
        platform_intent: "general",
        isConstructionRelated,
      };
    }

    return new Response(
      JSON.stringify({
        engineeredPrompt: parsed.engineeredPrompt,
        elements: parsed.elements,
        intent: parsed.intent || "cinematic_broll",
        platform_intent: parsed.platform_intent || "general",
        isConstructionRelated: parsed.isConstructionRelated ?? isConstructionRelated,
        rawPrompt: rawPrompt.trim(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "transform-video-prompt", requireCompany: false, wrapResult: false })
);
