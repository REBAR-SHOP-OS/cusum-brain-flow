import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return null;
  return { userId: user.id };
}

const SYSTEM_PROMPT = `You are a world-class AI creative director specializing in B2B industrial video advertising.

Your job: Analyze a 30-second ad script and produce a professional storyboard with scene-by-scene generation instructions.

For each script segment, produce:
- segment identification (hook, problem, solution, service, credibility, cta, closing)
- timing (startTime, endTime in seconds)
- storyboard scene with:
  - objective: what the scene achieves
  - visualStyle: cinematic description
  - shotType: wide, medium, close-up, aerial, POV, etc.
  - cameraMovement: dolly, crane, steadicam, static, slow pan, etc.
  - environment: location description
  - subjectAction: what's happening
  - emotionalTone: urgency, confidence, premium, etc.
  - transitionNote: how to transition to next scene
  - generationMode: one of "text-to-video", "image-to-video", "reference-continuation", "static-card", "motion-graphics"
  - continuityRequirements: what must carry over from the previous scene
  - prompt: a detailed, cinematic video generation prompt optimized for AI video generation (Wan 2.6 / Sora style). Must be specific, visual, and avoid generic AI aesthetics.

Also produce a ContinuityProfile object:
- subjectDescriptions, wardrobe, environment, timeOfDay, cameraStyle, motionRhythm, colorMood, lightingType, objectPlacement, lastFrameSummary, nextSceneBridge

For clips after the first, always include in the prompt: "Continue seamlessly from the previous clip, preserving location, subject continuity, camera language, lighting, pacing, and cinematic tone."

Optimize for: cinematic realism, dramatic industrial environments, premium B2B ad quality, believable construction workflows, realistic materials, controlled camera movement, strong visual storytelling, elegant pacing.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { script, brand, assetDescriptions } = await req.json();
    if (!script) return new Response(JSON.stringify({ error: "Script is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `Analyze this 30-second ad script and create a complete storyboard.

Brand: ${brand?.name || "Rebar.Shop"}
Website: ${brand?.website || "Rebar.Shop"}
CTA: ${brand?.cta || "Upload your drawings and get fast rebar shop drawings delivered."}
Tagline: ${brand?.tagline || "Fast, precise rebar detailing when time matters."}
Target Audience: ${brand?.targetAudience || "Construction contractors and engineers"}
${assetDescriptions ? `Available Assets: ${assetDescriptions}` : "No reference assets uploaded — use text-to-video for all scenes."}

Script:
${script}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_storyboard",
            description: "Create a structured storyboard from the ad script analysis",
            parameters: {
              type: "object",
              properties: {
                segments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: { type: "string", enum: ["hook", "problem", "consequence", "solution", "service", "credibility", "urgency", "cta", "closing"] },
                      label: { type: "string" },
                      text: { type: "string" },
                      startTime: { type: "number" },
                      endTime: { type: "number" },
                    },
                    required: ["id", "type", "label", "text", "startTime", "endTime"],
                  },
                },
                storyboard: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      segmentId: { type: "string" },
                      objective: { type: "string" },
                      visualStyle: { type: "string" },
                      shotType: { type: "string" },
                      cameraMovement: { type: "string" },
                      environment: { type: "string" },
                      subjectAction: { type: "string" },
                      emotionalTone: { type: "string" },
                      transitionNote: { type: "string" },
                      generationMode: { type: "string", enum: ["text-to-video", "image-to-video", "reference-continuation", "static-card", "motion-graphics"] },
                      continuityRequirements: { type: "string" },
                      prompt: { type: "string" },
                    },
                    required: ["id", "segmentId", "objective", "visualStyle", "shotType", "cameraMovement", "environment", "subjectAction", "emotionalTone", "transitionNote", "generationMode", "continuityRequirements", "prompt"],
                  },
                },
                continuityProfile: {
                  type: "object",
                  properties: {
                    subjectDescriptions: { type: "string" },
                    wardrobe: { type: "string" },
                    environment: { type: "string" },
                    timeOfDay: { type: "string" },
                    cameraStyle: { type: "string" },
                    motionRhythm: { type: "string" },
                    colorMood: { type: "string" },
                    lightingType: { type: "string" },
                    objectPlacement: { type: "string" },
                    lastFrameSummary: { type: "string" },
                    nextSceneBridge: { type: "string" },
                  },
                  required: ["subjectDescriptions", "wardrobe", "environment", "timeOfDay", "cameraStyle", "motionRhythm", "colorMood", "lightingType", "objectPlacement", "lastFrameSummary", "nextSceneBridge"],
                },
              },
              required: ["segments", "storyboard", "continuityProfile"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_storyboard" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-ad-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
