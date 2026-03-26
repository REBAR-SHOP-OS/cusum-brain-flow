import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

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
  | "optimize-ad"
  | "write-script";

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
  "analyze-script":         { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.1, maxTokens: 16384 },
  "generate-storyboard":    { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.2, maxTokens: 16384 },
  "write-cinematic-prompt": { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.7, maxTokens: 2048 },
  "improve-prompt":         { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.6, maxTokens: 2048 },
  "rewrite-cta":            { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.5, maxTokens: 1024 },
  "generate-voiceover":     { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.4, maxTokens: 2048 },
  "optimize-ad":            { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.5, maxTokens: 4096 },
  "write-script":           { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.7, maxTokens: 4096 },

  // Google-led: vision, multimodal, evaluation, classification
  "score-prompt-quality":   { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.1, maxTokens: 1024 },
  "analyze-reference":      { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.2, maxTokens: 4096 },
  "continuity-check":       { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.1, maxTokens: 2048 },
  "classify-scene":         { model: "google/gemini-2.5-flash",      fallback: "google/gemini-2.5-flash-lite", temperature: 0.1, maxTokens: 1024 },
  "quality-review":         { model: "google/gemini-2.5-pro",        fallback: "google/gemini-2.5-flash",      temperature: 0.2, maxTokens: 4096 },
  "generate-subtitles":     { model: "google/gemini-2.5-flash-lite", fallback: "google/gemini-2.5-flash",      temperature: 0.1, maxTokens: 2048 },
};

// Auth is now handled by handleRequest wrapper

// ─── AI Gateway Call with Fallback ──────────────────────────────
const PER_ATTEMPT_TIMEOUT_MS = 50_000; // 50s default per single AI call attempt
const HEAVY_ATTEMPT_TIMEOUT_MS = 80_000; // 80s for heavy routes (analyze-script, generate-storyboard)
const HEAVY_ROUTES: Set<string> = new Set(["analyze-script", "generate-storyboard"]);

async function callAI(
  apiKey: string,
  route: ModelRoute,
  messages: Array<{ role: string; content: string }>,
  tools?: any[],
  toolChoice?: any,
  modelOverride?: string,
  taskType?: string,
): Promise<{ data: any; modelUsed: string; fallbackUsed: boolean }> {
  const model = modelOverride || route.model;
  const timeoutMs = (taskType && HEAVY_ROUTES.has(taskType)) ? HEAVY_ATTEMPT_TIMEOUT_MS : PER_ATTEMPT_TIMEOUT_MS;

  const body: any = {
    model,
    messages,
    max_tokens: route.maxTokens,
  };
  // Cap reasoning tokens for Gemini Pro to prevent thinking from exhausting the budget
  if (model.includes("gemini-2.5-pro")) {
    body.thinking = { thinking_budget: 4096 };
  }
  // Only send temperature for models that support it (not OpenAI)
  if (!model.startsWith("openai/")) {
    body.temperature = route.temperature;
  }
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const sendRequest = (payload: Record<string, unknown>) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  };

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

  // 2. Fallback: model returned content as text (also check on finish_reason error)
  const content = data.choices?.[0]?.message?.content || "";
  const finishReason = data.choices?.[0]?.finish_reason;

  // Even on finish_reason "error", check if there's parseable content first
  if (content) {
    console.warn("extractToolResult: extracting JSON from content text. finish_reason:", finishReason, "length:", content.length);
    try {
      return extractJSONFromText(content);
    } catch (e) {
      // If finish_reason was error, throw retryable; otherwise re-throw parse error
      if (finishReason === "error") {
        console.error("extractToolResult: content parse failed + finish_reason=error. Retryable.");
        throw new Error("AI returned malformed function call — please retry");
      }
      throw e;
    }
  }

  // No content at all
  if (finishReason === "error") {
    console.error("extractToolResult: finish_reason=error, no content. Retryable.");
    throw new Error("AI returned malformed function call — please retry");
  }
  console.error("extractToolResult: No tool_calls and no content. finish_reason:", finishReason, "raw:", JSON.stringify(data).slice(0, 800));
  throw new Error("AI did not return structured data");
}

/** Wraps callAI + extractToolResult with retries on malformed function calls.
 *  For heavy routes (analyze-script, generate-storyboard): 1 primary attempt, then immediately fallback.
 *  For lighter routes: up to 2 primary attempts, then fallback. */
async function callAIAndExtract(
  apiKey: string,
  route: ModelRoute,
  messages: any[],
  tools: any[],
  toolChoice: any,
  modelOverride?: string,
  taskType?: string,
): Promise<{ result: any; modelUsed: string; fallbackUsed: boolean }> {
  // Heavy routes get fewer retries to stay under client timeout
  const isHeavyRoute = taskType === "analyze-script" || taskType === "generate-storyboard";
  const MAX_RETRIES = isHeavyRoute ? 1 : 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Switch to fallback on last attempt
    const effectiveOverride = (attempt === MAX_RETRIES && route.fallback)
      ? route.fallback
      : modelOverride;
    const usingFallback = attempt === MAX_RETRIES && route.fallback ? true : false;
    if (usingFallback) {
      console.warn(`callAIAndExtract: switching to fallback model ${route.fallback} (attempt ${attempt}, task=${taskType})`);
    }
    try {
      const { data, modelUsed, fallbackUsed } = await callAI(apiKey, route, messages, tools, toolChoice, effectiveOverride, taskType);
      return { result: extractToolResult(data), modelUsed, fallbackUsed: fallbackUsed || usingFallback };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRetryable = msg.includes("malformed function call") || msg.includes("did not return structured data") || msg.includes("AbortError") || msg.includes("aborted");
      if (isRetryable && attempt < MAX_RETRIES) {
        console.warn(`callAIAndExtract: retry ${attempt + 1}/${MAX_RETRIES} after: ${msg} (task=${taskType})`);
        continue;
      }
      throw e;
    }
  }
  throw new Error("callAIAndExtract: exhausted retries");
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
const ANALYZE_SCRIPT_PROMPT = `You are a cinematic ad director for premium B2B video ads. Analyze the script and produce a broadcast-quality storyboard.

## STRUCTURE

### Scene 1: CINEMATIC INTRO (0-2s, type "hook", label "Cinematic Intro")
- Pure visual establishing shot, NO text/narration/logos in video prompt
- Brand logo overlay is automatic (CSS) — state this in objective
- generationMode: "text-to-video"

### Last Scene: BRANDED END CARD (3-4s, type "closing", label "Branded End Card")  
- generationMode: "static-card" — rendered by Canvas, NOT video model
- Include brand name, tagline, CTA, website, colors as metadata
- NO cinematic camera descriptions — it's a static card
- Brand logo overlay is automatic — state this in objective

## TRANSITIONS (required for every scene)
- Hook→Problem: hard cut / whip pan
- Problem→Solution: dramatic reveal (dolly push-in, crane up, light shift)
- Solution→Service: dissolve / wipe matching camera direction
- Service/Credibility→CTA: slow dissolve / zoom into brand element
- CTA→End Card: fade-to-brand-color / brand-wipe
Never use generic "cut" — specify type + reasoning.

## PACING
- Each scene MUST be exactly 15 seconds long. No exceptions.
- Scene count: 15s ad = 1 scene, 30s ad = 2 scenes, 60s ad = 4 scenes
- Do NOT create more scenes than specified. Each scene = one 15-second video clip.
- Voiceover constraint: minDuration = ceil(wordCount / 2.5). Never compress narration.

## SCENE OUTPUT (for each scene)
- segment: type, label, text, startTime, endTime
- storyboard: objective, visualStyle, shotType, cameraMovement, environment, subjectAction, emotionalTone, transitionNote, generationMode, continuityRequirements, prompt, voiceover
- voiceover: The exact narration/voiceover script for this scene. Natural, conversational, punchy advertising copy. This text will be read aloud by a narrator over the video. Must match the scene's emotional tone and duration.

## CONTINUITY PROFILE
Return: subjectDescriptions, wardrobe, environment, timeOfDay, cameraStyle, motionRhythm, colorMood, lightingType, objectPlacement, lastFrameSummary, nextSceneBridge

## CROSS-SCENE COHERENCE RULES (CRITICAL)
- ALL scenes MUST share the same color palette, lighting style, and environment type unless the script explicitly changes location
- Subject descriptions MUST be identical across all scenes — same person, same clothing, same props, same physical appearance
- Every scene prompt after scene 1 MUST begin with a "continuity anchor": "Continuing in the same [environment], same [lighting], same [subject appearance] as previous scenes —"
- The viewer MUST feel all clips are from the SAME film shoot, same location, same day, same camera setup
- Color grading, contrast level, and saturation MUST remain consistent across all scenes
- If scene 1 establishes warm golden lighting, ALL subsequent scenes must maintain warm golden lighting
- Camera lens characteristics (focal length, depth of field) should remain consistent unless creatively motivated

## PROMPT RULES (80-150 words each)
- Specific camera specs (lens mm, f-stop), lighting angles, material textures
- NO camera brand names (ARRI, RED, Sony) — describe characteristics instead
- NO text/titles/brand names in video prompts — overlays handled by editor
- After scene 1: "Continue seamlessly from previous clip, preserving location, subject, lighting, pacing"
- Each prompt MUST embed the continuity profile details (environment, lighting, color mood, subject) directly into the description
- Example lighting: "golden hour backlight, tungsten fill 45° left, volumetric haze"
- Example materials: "weathered steel rebar with rust patina, fresh concrete with moisture sheen"`;

const WRITE_CINEMATIC_PROMPT_SYSTEM = `Rewrite scene prompts into 80-150 word cinematic video generation prompts. Be specific: lens mm, f-stop, lighting angles, material textures, movement speed. NO camera brand names, NO text/titles in prompts.

CRITICAL COHERENCE REQUIREMENT:
- Every prompt after scene 1 MUST begin with a visual continuity statement that references the exact same environment, lighting, color palette, and subject appearance from the continuity profile.
- You MUST embed the continuity profile details (subject descriptions, wardrobe, environment, lighting type, color mood) directly into every prompt as visual anchors.
- The viewer must feel ALL clips are from the SAME film shoot — same location, same day, same camera setup, same color grading.
- Start continuation prompts with: "In the same [environment] with [lighting], [subject with exact appearance] —"
- Never introduce new visual elements, color schemes, or lighting setups that contradict the established continuity profile.`;

const SCORE_QUALITY_PROMPT = `Score this video generation prompt on 7 dimensions (0-10): realism, specificity, visualRichness, continuityStrength, brandRelevance, emotionalPersuasion, cinematicClarity. Include overall score and suggestion if < 7.`;

const IMPROVE_PROMPT_SYSTEM = `Rewrite this below-threshold video prompt to be more specific and cinematic. Add precise camera/lens/lighting details, material textures, atmospheric conditions. Preserve scene objective and emotional tone. Ensure continuity with adjacent scenes.`;

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
              voiceover: { type: "string", description: "Voiceover narration script for this scene — natural, punchy advertising copy to be read aloud by a narrator" },
            },
            required: ["id", "segmentId", "objective", "visualStyle", "shotType", "cameraMovement", "environment", "subjectAction", "emotionalTone", "transitionNote", "generationMode", "continuityRequirements", "prompt", "voiceover"],
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

// ─── Product & Style Mappings ────────────────────────────────────
const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  fiberglass: "Fiberglass GFRP (Glass Fiber Reinforced Polymer) reinforcement bars — lightweight, corrosion-resistant, non-conductive composite rebar used in concrete structures",
  stirrups: "Steel stirrups — closed-loop bent reinforcement bars used to hold longitudinal rebar in position and resist shear forces in beams and columns",
  cages: "Rebar cages — pre-assembled cylindrical or rectangular frameworks of welded reinforcement bars used in foundations, columns, and piles",
  hooks: "Rebar hooks — steel reinforcing bars with bent ends (90° or 180° hooks) for anchorage in concrete connections",
  dowels: "Dowel bars — smooth or deformed steel bars used at construction joints in slabs and pavements to transfer loads",
  "wire-mesh": "Welded wire mesh (WWM) — factory-welded steel grid panels used for slab-on-grade reinforcement, crack control, and temperature reinforcement",
  "straight-rebar": "Straight rebar — standard deformed steel reinforcing bars in various sizes used as primary tensile reinforcement in concrete structures",
};

const STYLE_DESCRIPTIONS: Record<string, string> = {
  realism: "Photorealistic — real-world professional photography/cinematography look with natural lighting, real textures, and lifelike environments",
  cinematic: "Cinematic — dramatic Hollywood-grade visuals with depth of field, lens flares, color grading, and epic scale compositions",
  "3d-render": "3D Rendered — clean CGI visualization with polished materials, studio lighting, and technical precision",
  minimal: "Minimalist — clean, simple compositions with negative space, muted palette, and elegant typography",
  industrial: "Industrial — raw, powerful factory/construction-site aesthetic with heavy machinery, steel textures, and gritty authenticity",
  technical: "Technical — engineering-focused with blueprints, cross-sections, detailed specs, and precise measurements visible",
};

function buildProductStyleDirective(selectedProducts?: string[], selectedStyles?: string[]): string {
  const parts: string[] = [];
  if (selectedProducts?.length) {
    const descriptions = selectedProducts.map(p => PRODUCT_DESCRIPTIONS[p] || p).join("; ");
    parts.push(`\n\n═══ MANDATORY PRODUCT DIRECTIVE ═══\nThe video MUST prominently feature and focus on: ${descriptions}.\nEvery scene must showcase this product in use, being installed, manufactured, or demonstrated. The product must be the visual centerpiece — never generic or absent.`);
  }
  if (selectedStyles?.length) {
    const descriptions = selectedStyles.map(s => STYLE_DESCRIPTIONS[s] || s).join("; ");
    parts.push(`\n\n═══ MANDATORY VISUAL STYLE DIRECTIVE ═══\nThe video MUST be produced in this visual style: ${descriptions}.\nApply this aesthetic consistently to every scene — lighting, color grading, composition, and post-processing must all reflect this style.`);
  }
  return parts.join("");
}

// ─── Action Handlers ────────────────────────────────────────────

async function handleAnalyzeScript(apiKey: string, body: any, modelOverride?: string) {
  const { script, brand, assetDescriptions, characterImageUrl, introImageUrl, outroImageUrl, sceneCount, selectedProducts, selectedStyles } = body;
  if (!script) throw new Error("Script is required");

  const characterBlock = characterImageUrl
    ? `\n\nIMPORTANT — CHARACTER/NARRATOR REFERENCE: A reference photo of a real spokesperson/narrator has been provided. This person MUST appear in EVERY scene (except closing/end-card) as the primary subject presenting or demonstrating the product/service. Rules:
- Describe this person consistently across ALL scenes (same appearance, clothing, features).
- Set generationMode to "image-to-video" for every scene featuring this person.
- Include this person's description in continuityProfile.subjectDescriptions.
- The narrator should be performing contextual actions relevant to each scene (speaking, demonstrating, gesturing, walking through the environment).
- Never replace them with a generic or different person.`
    : "";

  const introBlock = introImageUrl
    ? `\n\nINTRO REFERENCE IMAGE: A reference image has been provided for the opening scene. Scene 1 (hook) MUST visually match and be inspired by this image — same composition, color palette, and visual style. Set generationMode to "image-to-video" for scene 1.`
    : "";

  const outroBlock = outroImageUrl
    ? `\n\nOUTRO REFERENCE IMAGE: A reference image has been provided for the closing visual scene. The LAST visual scene (before any end-card) MUST visually match and be inspired by this image — same composition, color palette, and visual style. Set generationMode to "image-to-video" for that scene.`
    : "";

  const productStyleDirective = buildProductStyleDirective(selectedProducts, selectedStyles);

  const userPrompt = `Brand: ${brand?.name || "Rebar.Shop"} | Website: ${brand?.website || "Rebar.Shop"} | CTA: ${brand?.cta || "Upload your drawings and get fast rebar shop drawings delivered."} | Tagline: ${brand?.tagline || "Fast, precise rebar detailing when time matters."} | Audience: ${brand?.targetAudience || "Construction contractors and engineers"} | Colors: ${brand?.primaryColor || "#ef4444"} / ${brand?.secondaryColor || "#1e293b"} | Aesthetic: ${brand?.referenceAesthetic || "Premium cinematic industrial B2B"}
${assetDescriptions ? `Assets: ${assetDescriptions}` : "No reference assets — use text-to-video."}${characterBlock}${introBlock}${outroBlock}${productStyleDirective}

Script:
${script}
${sceneCount ? `\nCRITICAL: You MUST create exactly ${sceneCount} scene(s), each exactly 15 seconds long. Do NOT create more or fewer scenes.` : ""}`;

  return await callAIAndExtract(
    apiKey,
    MODEL_ROUTES["analyze-script"],
    [{ role: "system", content: ANALYZE_SCRIPT_PROMPT }, { role: "user", content: userPrompt }],
    ANALYZE_SCRIPT_TOOLS,
    { type: "function", function: { name: "create_storyboard" } },
    modelOverride,
    "analyze-script",
  );
}

async function handleWriteCinematicPrompt(apiKey: string, body: any, modelOverride?: string) {
  const { scene, brand, continuityProfile, previousScene, characterImageUrl, introImageUrl, outroImageUrl, sceneIndex, totalScenes, selectedProducts, selectedStyles } = body;
  if (!scene) throw new Error("Scene data is required");

  const continuityBlock = continuityProfile ? `
## MANDATORY CONTINUITY PROFILE (embed these details into the prompt):
- Subject: ${continuityProfile.subjectDescriptions || "N/A"}
- Wardrobe: ${continuityProfile.wardrobe || "N/A"}
- Environment: ${continuityProfile.environment || "N/A"}
- Time of Day: ${continuityProfile.timeOfDay || "N/A"}
- Lighting: ${continuityProfile.lightingType || "N/A"}
- Color Mood: ${continuityProfile.colorMood || "N/A"}
- Camera Style: ${continuityProfile.cameraStyle || "N/A"}
- Motion Rhythm: ${continuityProfile.motionRhythm || "N/A"}
You MUST weave ALL of these visual anchors into the rewritten prompt so the video model generates visuals consistent with all other scenes.` : "";

  const isFirstScene = sceneIndex === 0;
  const isLastVisualScene = sceneIndex === (totalScenes != null ? totalScenes - 1 : -1);

  const introRefBlock = (isFirstScene && introImageUrl)
    ? `\nINTRO REFERENCE: A reference image is provided for this opening scene. The prompt MUST describe visuals that closely match the composition, colors, subjects, and style of this reference image. This scene should feel like the image has come alive.`
    : "";

  const outroRefBlock = (isLastVisualScene && outroImageUrl)
    ? `\nOUTRO REFERENCE: A reference image is provided for this closing visual scene. The prompt MUST describe visuals that closely match the composition, colors, subjects, and style of this reference image. This scene should feel like the image has come alive.`
    : "";

  const productStyleDirective = buildProductStyleDirective(selectedProducts, selectedStyles);

  const userPrompt = `Rewrite this scene's prompt into a premium cinematic video generation prompt.
${continuityBlock}

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
${previousScene ? `Previous Scene Summary: ${previousScene.prompt?.slice(0, 200)}` : "This is the FIRST scene — establish the visual identity that ALL subsequent scenes must follow."}
${continuityProfile ? `Full Continuity JSON: ${JSON.stringify(continuityProfile)}` : ""}
${characterImageUrl ? `\nCHARACTER REFERENCE: A real person's photo is provided as the narrator/spokesperson. The prompt MUST describe this person as the central subject performing actions in this scene. Never replace them with a generic person. Ensure the person's appearance matches across all scenes.` : ""}${introRefBlock}${outroRefBlock}${productStyleDirective}`;

  return await callAIAndExtract(
    apiKey,
    MODEL_ROUTES["write-cinematic-prompt"],
    [{ role: "system", content: WRITE_CINEMATIC_PROMPT_SYSTEM }, { role: "user", content: userPrompt }],
    WRITE_PROMPT_TOOLS,
    { type: "function", function: { name: "write_prompt" } },
    modelOverride,
  );
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

  return await callAIAndExtract(
    apiKey,
    MODEL_ROUTES["score-prompt-quality"],
    [{ role: "system", content: SCORE_QUALITY_PROMPT }, { role: "user", content: userPrompt }],
    SCORE_QUALITY_TOOLS,
    { type: "function", function: { name: "score_prompt" } },
    modelOverride,
  );
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

  return await callAIAndExtract(
    apiKey,
    MODEL_ROUTES["improve-prompt"],
    [{ role: "system", content: IMPROVE_PROMPT_SYSTEM }, { role: "user", content: userPrompt }],
    WRITE_PROMPT_TOOLS,
    { type: "function", function: { name: "write_prompt" } },
    modelOverride,
  );
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
    taskType,
  );

  return { result: { text: extractContent(data) }, modelUsed, fallbackUsed };
}

// ─── Write Script Handler ───────────────────────────────────────
const WRITE_SCRIPT_SYSTEM = `You are an expert ad scriptwriter for B2B video ads. Write a timed 30-second ad script with these sections:
- Hook (0:00-0:04): Grab attention with a bold statement about the problem
- Problem (0:04-0:09): Show the pain point with urgency
- Solution (0:09-0:16): Present the product/service as the answer
- Service (0:16-0:21): Detail what's included
- Credibility (0:21-0:25): Build trust (expertise, speed, technology)
- Call to Action (0:25-0:30): Direct clear CTA
- Closing Tagline: One-line brand tagline

Format each section with timestamps and labels, like "0:00–0:04 — Hook". Write in a punchy, conversational, professional tone. Keep narration natural and speakable aloud.`;

// ─── Main Handler ───────────────────────────────────────────────
Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
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
        result = await handleAnalyzeScript(LOVABLE_API_KEY, body, modelOverride);
        break;
      case "write-script": {
        const { input: desc, brand: scriptBrand } = body;
        if (!desc) throw new Error("Product description is required");
        const userMsg = `Write a 30-second ad script for: ${desc}\n\nBrand: ${scriptBrand?.name || "Company"}\nWebsite: ${scriptBrand?.website || ""}\nCTA: ${scriptBrand?.cta || ""}\nTagline: ${scriptBrand?.tagline || ""}\nAudience: ${scriptBrand?.targetAudience || "B2B professionals"}`;
        result = await handleSimpleTextTask(LOVABLE_API_KEY, taskType, { input: userMsg }, WRITE_SCRIPT_SYSTEM, modelOverride);
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unhandled action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return {
      result: result.result,
      modelUsed: result.modelUsed,
      fallbackUsed: result.fallbackUsed,
      taskType,
    };
  }, { functionName: "ad-director-ai", requireCompany: false, wrapResult: false })
);
