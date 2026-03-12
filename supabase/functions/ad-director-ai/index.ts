import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Model Routing Table ────────────────────────────────────────
type TaskType =
  | "analyze-script"
  | "generate-storyboard"
  | "write-cinematic-prompt"
  | "score-prompt-quality"
  | "improve-prompt"
  | "analyze-reference"
  | "continuity-check"
  | "rewrite-cta"
  | "generate-subtitles"
  | "generate-voiceover"
  | "classify-scene"
  | "quality-review"
  | "optimize-ad";

interface ModelRoute {
  model: string;
  fallback: string;
  temperature: number;
  maxTokens: number;
}

// ─── Provider Philosophy ────────────────────────────────────
// GPT  = planning, reasoning, script analysis, prompt writing, ad polish, creative copy
// Google = multimodal understanding, image/frame analysis, continuity inspection, vision, classification
// Alibaba = video generation (handled by generate-video, not this function)
// Fallbacks always cross provider boundaries for resilience.

const MODEL_ROUTES: Record<TaskType, ModelRoute> = {
  // Gemini Pro: reasoning, planning, creative writing (faster than GPT, avoids timeout)
  "analyze-script":         { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.1, maxTokens: 8192 },
  "generate-storyboard":    { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.2, maxTokens: 8192 },
  "write-cinematic-prompt": { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.7, maxTokens: 2048 },
  "improve-prompt":         { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.6, maxTokens: 2048 },
  "rewrite-cta":            { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.5, maxTokens: 1024 },
  "generate-voiceover":     { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.4, maxTokens: 2048 },
  "optimize-ad":            { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.5, maxTokens: 4096 },

  // Google-led: vision, multimodal, evaluation, classification
  "score-prompt-quality":   { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.1, maxTokens: 1024 },
  "analyze-reference":      { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.2, maxTokens: 4096 },
  "continuity-check":       { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.1, maxTokens: 2048 },
  "classify-scene":         { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.1, maxTokens: 1024 },
  "quality-review":         { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.2, maxTokens: 4096 },
  "generate-subtitles":     { model: "google/gemini-2.5-flash-lite", fallback: "google/gemini-2.5-flash",      temperature: 0.1, maxTokens: 2048 },
};

// ─── Auth Helper ────────────────────────────────────────────────
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

// ─── AI Gateway Call with Fallback ──────────────────────────────
async function callAI(
  apiKey: string,
  route: ModelRoute,
  messages: Array<{ role: string; content: string }>,
  tools?: any[],
  toolChoice?: any,
  modelOverride?: string,
): Promise<{ data: any; modelUsed: string; fallbackUsed: boolean }> {
  const model = modelOverride || route.model;

  const body: any = {
    model,
    messages,
    max_completion_tokens: route.maxTokens,
  };
  // Only send temperature for models that support it (not OpenAI)
  if (!model.startsWith("openai/")) {
    body.temperature = route.temperature;
  }
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const sendRequest = (payload: Record<string, unknown>) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const sendWithTemperatureFallback = async (payload: Record<string, unknown>) => {
    let res = await sendRequest(payload);

    if (!res.ok && res.status === 400 && payload.temperature !== undefined) {
      const errText = await res.clone().text();
      if (errText.toLowerCase().includes("temperature") && errText.toLowerCase().includes("unsupported")) {
        console.warn(`Model ${String(payload.model)} rejected temperature; retrying with default temperature.`);
        const retryPayload = { ...payload };
        delete retryPayload.temperature;
        res = await sendRequest(retryPayload);
      }
    }

    return res;
  };

  let response = await sendWithTemperatureFallback(body as Record<string, unknown>);

  // If primary fails with 5xx or 429, try fallback
  if (!response.ok && (response.status >= 500 || response.status === 429) && !modelOverride) {
    console.warn(`Primary model ${model} failed (${response.status}), falling back to ${route.fallback}`);
    body.model = route.fallback;
    response = await sendWithTemperatureFallback(body as Record<string, unknown>);

    if (!response.ok) {
      const errText = await response.text();
      console.error("Fallback model also failed:", response.status, errText);
      throw new Error(response.status === 429 ? "Rate limited — please try again." : response.status === 402 ? "AI credits exhausted." : "AI generation failed");
    }

    const fallbackText = await response.text();
    let data: any;
    try { data = JSON.parse(fallbackText); } catch {
      console.error("Fallback returned non-JSON:", fallbackText.slice(0, 300));
      throw new Error("AI returned malformed response");
    }
    return { data, modelUsed: route.fallback, fallbackUsed: true };
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    throw new Error(response.status === 429 ? "Rate limited — please try again." : response.status === 402 ? "AI credits exhausted." : "AI generation failed");
  }

  const rawText = await response.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    // Try to salvage truncated JSON from the response
    let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").replace(/[\x00-\x1F\x7F]/g, "").trim();
    const start = cleaned.search(/[\{\[]/);
    if (start === -1) {
      console.error("AI returned non-JSON response:", rawText.slice(0, 500));
      throw new Error("AI returned empty or non-JSON response");
    }
    cleaned = cleaned.substring(start);
    // Balance braces/brackets
    let braces = 0, brackets = 0;
    for (const ch of cleaned) { if (ch === '{') braces++; if (ch === '}') braces--; if (ch === '[') brackets++; if (ch === ']') brackets--; }
    if (braces > 0) cleaned += '}'.repeat(braces);
    if (brackets > 0) cleaned += ']'.repeat(brackets);
    cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    try {
      data = JSON.parse(cleaned);
      console.warn("Repaired truncated AI JSON response");
    } catch (e2) {
      console.error("Failed to repair AI JSON:", rawText.slice(0, 500));
      throw new Error("AI returned malformed response");
    }
    // Wrap repaired content to match expected structure
    if (!data.choices) {
      data = { choices: [{ message: { content: JSON.stringify(data) } }] };
    }
  }
  return { data, modelUsed: model, fallbackUsed: false };
}

function extractToolResult(data: any): any {
  // 1. Try tool_calls first (preferred path)
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      // Tool call arguments might be truncated — fall through to repair
      return repairAndParseJSON(toolCall.function.arguments);
    }
  }

  // 2. Fallback: model returned content as text
  const content = data.choices?.[0]?.message?.content || "";
  if (!content) {
    const finishReason = data.choices?.[0]?.finish_reason;
    // Gemini sometimes returns finish_reason "error" with MALFORMED_FUNCTION_CALL — treat as retryable
    if (finishReason === "error") {
      console.error("extractToolResult: AI returned finish_reason=error (likely MALFORMED_FUNCTION_CALL). Will throw for retry.");
      throw new Error("AI returned malformed function call — please retry");
    }
    console.error("extractToolResult: No tool_calls and no content. finish_reason:", finishReason, "keys:", JSON.stringify(Object.keys(data.choices?.[0]?.message || {})), "raw:", JSON.stringify(data).slice(0, 800));
    throw new Error("AI did not return structured data");
  }

  console.warn("extractToolResult: AI returned content instead of tool_calls, extracting JSON from text. Length:", content.length);

  return extractJSONFromText(content);
}

function extractJSONFromText(content: string): any {
  // Try direct parse
  try { return JSON.parse(content); } catch { /* continue */ }

  // Extract from markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch { /* continue */ }
    // Try repair on code block content
    try { return repairAndParseJSON(codeBlockMatch[1].trim()); } catch { /* continue */ }
  }

  // Find JSON object/array in mixed text
  const jsonMatch = content.match(/[\{\[][\s\S]*$/);
  if (jsonMatch) {
    // Try to find matching closing bracket
    let candidate = jsonMatch[0];
    const lastBrace = candidate.lastIndexOf("}");
    const lastBracket = candidate.lastIndexOf("]");
    const lastClose = Math.max(lastBrace, lastBracket);
    if (lastClose > 0) {
      candidate = candidate.substring(0, lastClose + 1);
    }
    try { return JSON.parse(candidate); } catch { /* continue */ }
    try { return repairAndParseJSON(candidate); } catch { /* continue */ }
  }

  // Check for refusal
  const refusalIndicators = ["I cannot", "I'm unable", "As a language model", "I apologize"];
  if (refusalIndicators.some(r => content.toLowerCase().includes(r.toLowerCase()))) {
    throw new Error("AI refused to process the request");
  }

  console.error("extractJSONFromText failed. Content preview:", content.slice(0, 500));
  throw new Error("AI did not return structured data");
}

function repairAndParseJSON(json: string): any {
  // Clean common issues
  let repaired = json
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\n/g, " ");

  // Count unbalanced braces/brackets and close them
  let braces = 0, brackets = 0;
  for (const char of repaired) {
    if (char === "{") braces++;
    if (char === "}") braces--;
    if (char === "[") brackets++;
    if (char === "]") brackets--;
  }
  while (brackets > 0) { repaired += "]"; brackets--; }
  while (braces > 0) { repaired += "}"; braces--; }

  try {
    return JSON.parse(repaired);
  } catch (e) {
    console.error("repairAndParseJSON failed:", repaired.slice(0, 300));
    throw new Error("AI did not return structured data");
  }
}

function extractContent(data: any): string {
  return data.choices?.[0]?.message?.content || "";
}

// ─── System Prompts ─────────────────────────────────────────────
const ANALYZE_SCRIPT_PROMPT = `You are a world-class AI creative director and video editor specializing in premium B2B industrial video advertising. You think like a Hollywood director — every frame matters.

Your job: Analyze a 30-second ad script and produce a professional, broadcast-quality storyboard with scene-by-scene generation instructions.

## MANDATORY STRUCTURE RULES

### 1. CINEMATIC INTRO (Scene 1 — 0-2s)
ALWAYS generate an opening establishing scene BEFORE the script narration begins:
- Duration: 0–2 seconds
- Purpose: Set the cinematic tone and hook the viewer visually
- Shot types: aerial/drone reveal, slow cinematic dolly, atmospheric wide shot, dramatic light reveal
- NO text, NO narration, NO logos, NO brand names in the VIDEO PROMPT — pure visual mood-setting only
- MANDATORY BRAND LOGO OVERLAY: The editing system will automatically render an animated brand logo overlay (fade-in + scale reveal) on this scene. Do NOT ask the video model to render any text or logo — it is handled as a CSS overlay.
- In the scene objective, explicitly state: "Brand logo will be rendered as an animated overlay (fade-in with scale reveal) — this is automatic and mandatory."
- Type this segment as "hook" with label "Cinematic Intro"
- generationMode: "text-to-video"
- Example: "Aerial drone shot descending through morning fog over a massive construction site, crane silhouettes against golden sunrise, 35mm anamorphic lens, f/2.8, shallow depth of field"

### 2. BRANDED OUTRO / END CARD (Last Scene — last 3-4s)
ALWAYS generate a closing branded end card as the FINAL scene:
- Duration: 3–4 seconds
- Purpose: Brand imprint with logo, tagline, CTA, and website
- MANDATORY BRAND LOGO OVERLAY: The editing system will automatically render the brand logo as an animated overlay on this scene. The logo is mandatory and automatic — do NOT rely on the video model to render it.
- In the scene objective, explicitly state: "Brand logo overlay is mandatory on this end card — applied automatically by the editor."
- generationMode: "static-card"
- Type this segment as "closing" with label "Branded End Card"
- IMPORTANT: The end card is NOT generated by the video model. It is rendered by the stitching engine using Canvas. The AI should NOT try to generate a video for this scene.
- Include in prompt: brand name, tagline, CTA text, website URL, and brand colors — these are used as metadata for the Canvas renderer, not as a video generation prompt
- Do NOT include cinematic camera descriptions for this scene — it is a static branded card

### 3. TRANSITION RULES (Enforced for every transitionNote)
Each scene MUST have a specific, professional transition. Use these rules:
- Hook/Intro → Problem: Hard cut or whip pan (creates urgency)
- Problem → Consequence: Quick crossfade or match-cut on geometry
- Problem/Consequence → Solution: Dramatic reveal — dolly push-in, crane up, or light shift from dark to bright
- Solution → Service: Smooth dissolve or wipe with motion direction matching camera movement
- Service → Credibility: Match-cut on similar shapes/movement or subtle zoom transition
- Credibility → CTA: Slow dissolve or gradual zoom into a brand element (logo, product, website)
- CTA → End Card: Elegant fade-to-brand-color or brand-wipe
- Between similar segment types: Match-cut on geometry, movement, or color continuity
NEVER use generic transitions like "cut" or "transition". Always specify the exact type and WHY.

### 4. PACING & RHYTHM
- Intro/Hook scenes: 2-3 seconds (fast, punchy, attention-grabbing)
- Problem/Urgency scenes: 2-3 seconds (quick cuts to build tension)
- Solution/Service scenes: 3-5 seconds (slower, confident, let visuals breathe)
- Credibility scenes: 3-4 seconds (steady, authoritative)
- CTA scene: 3-4 seconds (clear, direct, actionable)
- End Card: 3-4 seconds (brand soak time)

### 5. SCENE COUNT
For a 30-second ad, generate exactly 6-8 scenes (including intro and outro).
For a 15-second ad, generate 4-5 scenes.
For a 60-second ad, generate 10-14 scenes.
Distribute time proportionally. Never create scenes shorter than 1.5s or longer than 6s.

## SCENE OUTPUT FORMAT

For each scene, produce:
- segment identification (hook, problem, consequence, solution, service, credibility, urgency, cta, closing)
- timing (startTime, endTime in seconds)
- storyboard scene with:
  - objective: what this scene achieves emotionally and narratively
  - visualStyle: specific aesthetic (e.g., "dark industrial cinematic", "bright corporate premium")
  - shotType: specific shot (e.g., "wide establishing", "medium close-up", "extreme close-up detail")
  - cameraMovement: precise movement (e.g., "slow dolly forward 2ft/s", "static locked-off tripod", "handheld tracking")
  - environment: detailed setting description
  - subjectAction: what happens in the frame
  - emotionalTone: the feeling this scene evokes
  - transitionNote: SPECIFIC transition type with reasoning (see rules above)
  - generationMode: one of "text-to-video", "image-to-video", "reference-continuation", "static-card", "motion-graphics"
  - continuityRequirements: visual elements that must persist from previous scene
  - prompt: detailed cinematic video generation prompt (80-150 words, extremely specific about camera, lighting, materials, textures, movement)

## CONTINUITY PROFILE
Also produce a ContinuityProfile object with: subjectDescriptions, wardrobe, environment, timeOfDay, cameraStyle, motionRhythm, colorMood, lightingType, objectPlacement, lastFrameSummary, nextSceneBridge

## CONTINUITY RULE
For clips after the first, always include in the prompt: "Continue seamlessly from the previous clip, preserving location, subject continuity, camera language, lighting, pacing, and cinematic tone."

## QUALITY STANDARDS
- Every prompt must be 80-150 words with specific camera specs (lens focal length, f-stop), lighting details, and material descriptions
- Avoid generic phrases: "professional", "high quality", "cinematic look" — be SPECIFIC
- CRITICAL: Do NOT mention camera brand names (e.g., "ARRI Alexa", "RED", "Sony", "Canon", "Blackmagic") in prompts. Video models render these as on-screen text. Instead describe the visual characteristics: "shot on 50mm anamorphic lens, f/2.8, shallow depth of field, 4K cinematic grade"
- Do NOT include any text, titles, watermarks, or brand names that should appear visually in the video — the overlay system handles all text
- Specify lighting: "golden hour backlight with tungsten fill from 45° left, volumetric haze"
- Describe materials: "weathered steel rebar bundles with rust patina, fresh concrete with moisture sheen"
- Include motion: "slow dolly forward at 2ft/s, slight crane up revealing construction scale"

Optimize for: cinematic realism, dramatic industrial environments, premium broadcast-quality B2B advertising.`;

const WRITE_CINEMATIC_PROMPT_SYSTEM = `You are a world-class cinematic prompt engineer specializing in AI video generation for premium B2B advertising.

Your job: Take a scene plan and rewrite its prompt into a highly specific, visually rich, cinematically precise generation prompt.

Rules:
- Be extremely specific about visual details: materials, textures, lighting angles, camera lens, movement speed
- Avoid generic descriptions like "professional looking" or "high quality"
- NEVER mention camera brand names (ARRI, RED, Sony, Canon, Blackmagic) — video models render these as on-screen text. Instead describe lens characteristics: "50mm anamorphic lens, f/2.8, shallow depth of field, 4K cinematic grade"
- Do NOT include any text, titles, or brand names in the prompt — all text overlays are handled by the editing system
- Specify exact lighting: "golden hour backlight with tungsten fill from 45° left"
- Describe materials precisely: "weathered steel rebar bundles with rust patina, fresh concrete with moisture sheen"
- Include motion details: "slow dolly forward at 2ft/s, slight crane up revealing scale"
- Aim for 80-150 words per prompt
- Must maintain brand consistency and emotional tone
- For continuation scenes, explicitly reference visual elements from the previous scene`;

const SCORE_QUALITY_PROMPT = `You are a quality evaluator for AI video generation prompts. Score each prompt on 7 dimensions (0-10 each):

1. realism: How photorealistic and physically accurate are the described visuals?
2. specificity: How precise and detailed are visual descriptions (vs generic)?
3. visualRichness: How much visual depth, texture, and layered detail?
4. continuityStrength: How well does it maintain visual consistency with adjacent scenes?
5. brandRelevance: How well does it serve the brand message and target audience?
6. emotionalPersuasion: How effectively does it create the intended emotional response?
7. cinematicClarity: How clear and executable are the camera, lighting, and composition instructions?

Return scores and a brief improvement suggestion if overall < 7.0.`;

const IMPROVE_PROMPT_SYSTEM = `You are a cinematic prompt improvement specialist. You receive a video generation prompt that scored below quality threshold.

Your job: Rewrite it to be significantly more specific, visually rich, and cinematically precise while preserving the scene's objective and emotional tone.

Focus on:
- Replace vague descriptions with precise visual details
- Add specific camera, lens, and lighting information
- Include material textures, environmental details, atmospheric conditions
- Ensure strong continuity references if it's not the first scene
- Maintain the original scene objective and emotional impact`;

// ─── Tool Schemas ───────────────────────────────────────────────
const ANALYZE_SCRIPT_TOOLS = [{
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
}];

const SCORE_QUALITY_TOOLS = [{
  type: "function",
  function: {
    name: "score_prompt",
    description: "Return quality scores for a video generation prompt",
    parameters: {
      type: "object",
      properties: {
        realism: { type: "number" },
        specificity: { type: "number" },
        visualRichness: { type: "number" },
        continuityStrength: { type: "number" },
        brandRelevance: { type: "number" },
        emotionalPersuasion: { type: "number" },
        cinematicClarity: { type: "number" },
        overall: { type: "number" },
        suggestion: { type: "string" },
      },
      required: ["realism", "specificity", "visualRichness", "continuityStrength", "brandRelevance", "emotionalPersuasion", "cinematicClarity", "overall"],
    },
  },
}];

const WRITE_PROMPT_TOOLS = [{
  type: "function",
  function: {
    name: "write_prompt",
    description: "Return the rewritten cinematic prompt",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The rewritten cinematic video generation prompt" },
        reasoning: { type: "string", description: "Brief explanation of improvements made" },
      },
      required: ["prompt"],
    },
  },
}];

// ─── Action Handlers ────────────────────────────────────────────

async function handleAnalyzeScript(apiKey: string, body: any, modelOverride?: string) {
  const { script, brand, assetDescriptions } = body;
  if (!script) throw new Error("Script is required");

  const userPrompt = `Analyze this ad script and create a complete cinematic storyboard with intro, transitions, and branded outro.

Brand: ${brand?.name || "Rebar.Shop"}
Website: ${brand?.website || "Rebar.Shop"}
CTA: ${brand?.cta || "Upload your drawings and get fast rebar shop drawings delivered."}
Tagline: ${brand?.tagline || "Fast, precise rebar detailing when time matters."}
Target Audience: ${brand?.targetAudience || "Construction contractors and engineers"}
Brand Colors: Primary ${brand?.primaryColor || "#ef4444"}, Secondary ${brand?.secondaryColor || "#1e293b"}
Visual Aesthetic: ${brand?.referenceAesthetic || "Premium cinematic industrial B2B"}
Font Style: ${brand?.fontStyle || "Modern Sans-Serif"}
${assetDescriptions ? `Available Assets: ${assetDescriptions}` : "No reference assets uploaded — use text-to-video for all scenes."}

IMPORTANT: 
- Start with a 0-2s cinematic intro establishing shot (before narration begins)
- End with a 3-4s branded end card using brand colors (${brand?.primaryColor || "#ef4444"} to ${brand?.secondaryColor || "#1e293b"} gradient)
- The intro scene MUST include an animated brand logo overlay — this is automatic and mandatory. Mention it in the scene objective.
- The outro/end card MUST include the brand logo overlay — this is automatic and mandatory. Mention it in the scene objective.
- Do NOT ask the video model to render logos or text — they are applied as CSS overlays by the editor.
- Use specific professional transitions between every scene (no generic "cut to next")
- Each prompt must be 80-150 words with camera specs, lighting, and material details

Script:
${script}`;

  const { data, modelUsed, fallbackUsed } = await callAI(
    apiKey,
    MODEL_ROUTES["analyze-script"],
    [{ role: "system", content: ANALYZE_SCRIPT_PROMPT }, { role: "user", content: userPrompt }],
    ANALYZE_SCRIPT_TOOLS,
    { type: "function", function: { name: "create_storyboard" } },
    modelOverride,
  );

  return { result: extractToolResult(data), modelUsed, fallbackUsed };
}

async function handleWriteCinematicPrompt(apiKey: string, body: any, modelOverride?: string) {
  const { scene, brand, continuityProfile, previousScene } = body;
  if (!scene) throw new Error("Scene data is required");

  const userPrompt = `Rewrite this scene's prompt into a premium cinematic video generation prompt.

Scene Objective: ${scene.objective}
Visual Style: ${scene.visualStyle}
Shot Type: ${scene.shotType}
Camera Movement: ${scene.cameraMovement}
Environment: ${scene.environment}
Subject Action: ${scene.subjectAction}
Emotional Tone: ${scene.emotionalTone}
Generation Mode: ${scene.generationMode}
Continuity Requirements: ${scene.continuityRequirements}

Original Prompt: ${scene.prompt}

Brand: ${brand?.name || "Rebar.Shop"} — ${brand?.tagline || ""}
${previousScene ? `Previous Scene Summary: ${previousScene.prompt?.slice(0, 200)}` : "This is the first scene."}
${continuityProfile ? `Continuity: ${JSON.stringify(continuityProfile)}` : ""}`;

  const { data, modelUsed, fallbackUsed } = await callAI(
    apiKey,
    MODEL_ROUTES["write-cinematic-prompt"],
    [{ role: "system", content: WRITE_CINEMATIC_PROMPT_SYSTEM }, { role: "user", content: userPrompt }],
    WRITE_PROMPT_TOOLS,
    { type: "function", function: { name: "write_prompt" } },
    modelOverride,
  );

  return { result: extractToolResult(data), modelUsed, fallbackUsed };
}

async function handleScorePromptQuality(apiKey: string, body: any, modelOverride?: string) {
  const { prompt, scene, brand } = body;
  if (!prompt) throw new Error("Prompt is required");

  const userPrompt = `Score this AI video generation prompt for quality.

Prompt: "${prompt}"

Scene Context:
- Objective: ${scene?.objective || "N/A"}
- Emotional Tone: ${scene?.emotionalTone || "N/A"}
- Generation Mode: ${scene?.generationMode || "text-to-video"}

Brand: ${brand?.name || "N/A"} targeting ${brand?.targetAudience || "B2B"}`;

  const { data, modelUsed, fallbackUsed } = await callAI(
    apiKey,
    MODEL_ROUTES["score-prompt-quality"],
    [{ role: "system", content: SCORE_QUALITY_PROMPT }, { role: "user", content: userPrompt }],
    SCORE_QUALITY_TOOLS,
    { type: "function", function: { name: "score_prompt" } },
    modelOverride,
  );

  return { result: extractToolResult(data), modelUsed, fallbackUsed };
}

async function handleImprovePrompt(apiKey: string, body: any, modelOverride?: string) {
  const { prompt, qualityScore, scene, brand } = body;
  if (!prompt) throw new Error("Prompt is required");

  const userPrompt = `Improve this video generation prompt. It scored ${qualityScore?.overall || "below threshold"}/10.

Current prompt: "${prompt}"

Quality breakdown:
${qualityScore ? Object.entries(qualityScore).filter(([k]) => k !== "suggestion" && k !== "overall").map(([k, v]) => `- ${k}: ${v}/10`).join("\n") : "N/A"}
${qualityScore?.suggestion ? `Suggestion: ${qualityScore.suggestion}` : ""}

Scene: ${scene?.objective || "N/A"} — ${scene?.emotionalTone || "N/A"}
Brand: ${brand?.name || "N/A"}`;

  const { data, modelUsed, fallbackUsed } = await callAI(
    apiKey,
    MODEL_ROUTES["improve-prompt"],
    [{ role: "system", content: IMPROVE_PROMPT_SYSTEM }, { role: "user", content: userPrompt }],
    WRITE_PROMPT_TOOLS,
    { type: "function", function: { name: "write_prompt" } },
    modelOverride,
  );

  return { result: extractToolResult(data), modelUsed, fallbackUsed };
}

async function handleSimpleTextTask(apiKey: string, taskType: TaskType, body: any, systemPrompt: string, modelOverride?: string) {
  const { input } = body;
  if (!input) throw new Error("Input is required");

  const { data, modelUsed, fallbackUsed } = await callAI(
    apiKey,
    MODEL_ROUTES[taskType],
    [{ role: "system", content: systemPrompt }, { role: "user", content: input }],
    undefined,
    undefined,
    modelOverride,
  );

  return { result: { text: extractContent(data) }, modelUsed, fallbackUsed };
}

// ─── Main Handler ───────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, modelOverrides } = body;
    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const taskType = action as TaskType;
    if (!MODEL_ROUTES[taskType]) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modelOverride = modelOverrides?.[taskType];
    let result: any;

    switch (taskType) {
      case "analyze-script":
        result = await handleAnalyzeScript(LOVABLE_API_KEY, body, modelOverride);
        break;

      case "write-cinematic-prompt":
        result = await handleWriteCinematicPrompt(LOVABLE_API_KEY, body, modelOverride);
        break;

      case "score-prompt-quality":
        result = await handleScorePromptQuality(LOVABLE_API_KEY, body, modelOverride);
        break;

      case "improve-prompt":
        result = await handleImprovePrompt(LOVABLE_API_KEY, body, modelOverride);
        break;

      case "rewrite-cta":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "You are a persuasive B2B copywriter. Rewrite this CTA to be more compelling, urgent, and action-oriented. Keep it under 15 words.", modelOverride);
        break;

      case "generate-subtitles":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "Extract timed subtitle segments from this ad script. Return one subtitle per line in SRT-like format: index, timestamp range, text.", modelOverride);
        break;

      case "generate-voiceover":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "Rewrite this ad script into smooth voiceover narration text. Natural conversational tone, concise, punchy. Remove stage directions.", modelOverride);
        break;

      case "classify-scene":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "Classify this scene description into one category: cinematic-hero, product-demo, testimonial, data-visual, cta-card, transition, b-roll. Return just the category.", modelOverride);
        break;

      case "quality-review":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "Review this full storyboard for quality issues: weak scenes, inconsistency, bland visuals, broken continuity, or off-brand messaging. Return a structured critique with scene-level notes.", modelOverride);
        break;

      case "optimize-ad":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "Polish and optimize this ad storyboard for maximum impact. Suggest pacing improvements, stronger emotional arcs, and visual upgrades.", modelOverride);
        break;

      case "continuity-check":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "Compare these two adjacent scene prompts and identify continuity issues: lighting changes, environment shifts, subject inconsistencies, camera style breaks. Return a list of issues found.", modelOverride);
        break;

      case "analyze-reference":
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, body,
          "Analyze this reference image/asset description and extract: dominant colors, environment type, lighting style, subjects present, mood, textures. Return structured analysis.", modelOverride);
        break;

      case "generate-storyboard":
        // Reuse analyze-script handler for this action
        result = await handleAnalyzeScript(LOVABLE_API_KEY, body, modelOverride);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unhandled action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({
      result: result.result,
      modelUsed: result.modelUsed,
      fallbackUsed: result.fallbackUsed,
      taskType,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ad-director-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
