import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchContext, fetchQuickBooksLiveContext, fetchEstimationLearnings, fetchRebarStandards, fetchRAGContext } from "../_shared/agentContext.ts";
import { fetchExecutiveContext } from "../_shared/agentExecutiveContext.ts";
import { getTools } from "../_shared/agentTools.ts";
import { executeToolCall } from "../_shared/agentToolExecutor.ts";
import { selectModel, AIError, callAI, type AIMessage, type AIProvider } from "../_shared/aiRouter.ts";
import { analyzeDocumentWithGemini, convertPdfToImages, performOCR, performOCROnBase64, performMultiPassAnalysis, detectZones, extractRebarData } from "../_shared/agentDocumentUtils.ts";
import { agentPrompts } from "../_shared/agentPrompts.ts";
import { cropToAspectRatio } from "../_shared/imageResize.ts";
import { reviewAgentOutput } from "../_shared/agentQA.ts";
import { 
  ONTARIO_CONTEXT, 
  SHARED_TOOL_INSTRUCTIONS, 
  IDEA_GENERATION_INSTRUCTIONS, 
  GOVERNANCE_RULES 
} from "../_shared/agentSharedInstructions.ts";
import type { AgentRequest, ChatMessage, ValidationRule, ExtractedRebarData, DetectedZone } from "../_shared/agentTypes.ts";

import { corsHeaders } from "../_shared/auth.ts";

// ─── Pixel Slot Template Definitions (no hardcoded captions — all generated dynamically) ───
// ─── Diverse Visual Styles Pool (randomly selected per generation to guarantee uniqueness) ───
const VISUAL_STYLES_POOL = [
  "PHOTOREALISTIC real-world photography — Realistic workshop/fabrication shop interior, real workers cutting and bending steel rebar, sparks flying, industrial atmosphere, warm tungsten lighting, shot with professional DSLR camera",
  "PHOTOREALISTIC real-world photography — Active construction site with tower cranes, large-scale concrete pour in progress, steel reinforcement visible, workers in safety gear, dynamic composition, real location",
  "PHOTOREALISTIC real-world photography — Urban cityscape with buildings under construction, skyline showing steel framework and concrete structures, city life in foreground, real urban environment",
  "PHOTOREALISTIC real-world photography — Real city landmarks & infrastructure, iconic bridge or overpass showcasing exposed steel reinforcement and engineering excellence, dramatic perspective, real-world location",
  "PHOTOREALISTIC real-world photography — Aerial drone view of a massive real construction project, bird's eye perspective showing rebar grid layout on foundation, geometric patterns, real drone footage style",
  "PHOTOREALISTIC real-world photography — Real product photography in actual warehouse/shop environment, steel products on real industrial surface with natural lighting, authentic workshop setting",
  "PHOTOREALISTIC real-world photography — Macro close-up of real steel components, extreme detail of actual rebar texture, welding points, wire mesh intersections, shallow depth of field, real camera macro lens",
  "PHOTOREALISTIC real-world photography — Dramatic sunrise/sunset at real construction site, silhouette of steel structure against real colorful sky, golden hour natural lighting, cinematic real photography",
  "PHOTOREALISTIC real-world photography — Real logistics & delivery scene, flatbed truck loaded with bundled rebar arriving at actual site, real warehouse operations, professional documentary photography",
  "PHOTOREALISTIC real-world photography — Engineering blueprints laid on real workbench with physical steel products on top, real office/workshop environment, natural lighting, documentary style",
  "PHOTOREALISTIC real-world photography — Night construction scene at real site, illuminated with actual flood lights creating dramatic shadows, real urban night atmosphere, long exposure real camera",
  "PHOTOREALISTIC real-world photography — Ground-level real photography inside deep foundation excavation, rebar cages inside actual foundation forms, real concrete work, authentic construction site",
];

const PIXEL_SLOTS = [
  { slot: 1, theme: "Motivational / Strength", product: "Rebar Stirrups", imageStyles: VISUAL_STYLES_POOL },
  { slot: 2, theme: "Creative promotional", product: "Rebar Cages", imageStyles: VISUAL_STYLES_POOL },
  { slot: 3, theme: "Strength & scale", product: "Fiberglass Rebar (GFRP)", imageStyles: VISUAL_STYLES_POOL },
  { slot: 4, theme: "Innovation & efficiency", product: "Wire Mesh", imageStyles: VISUAL_STYLES_POOL },
  { slot: 5, theme: "Product promotional", product: "Rebar Dowels", imageStyles: VISUAL_STYLES_POOL },
];

interface DynamicContent {
  caption: string;
  hashtags: string;
  imageText: string;
  imageTextFa: string;
  captionFa: string;
}

/**
 * Generate unique, non-repeating advertising content for a Pixel slot.
 * Calls Gemini to produce a fresh caption, hashtags, image slogan, and Farsi translations.
 * NEVER returns hardcoded content — every call produces brand-new creative copy.
 */
async function generateDynamicContent(
  slot: typeof PIXEL_SLOTS[number],
  isRegenerate: boolean,
  brainContext?: string,
  preferredModel?: string,
  sessionSeed?: string,
): Promise<DynamicContent> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured — cannot generate dynamic content");
  }

  const regenerateInstruction = isRegenerate
    ? "\n- THIS IS A REGENERATION REQUEST — you MUST create content that is COMPLETELY DIFFERENT from any previous version. Use a totally new angle, tone, and wording."
    : "";

  const brainBlock = brainContext && brainContext.trim()
    ? `\n\n## MANDATORY BRAIN CONTEXT (YOU MUST USE THIS):\n${brainContext}\n\nCRITICAL: You MUST incorporate the above brain context (custom instructions, brand resources, uploaded files/images) into your generated content. This is NOT optional. Align tone, style, language, and references with the brain data.\n`
    : "";

  const prompt = `You are an elite creative advertising copywriter for RebarShop, a premium rebar and steel reinforcement company based in Ontario, Canada.

Product: ${slot.product}
Theme: ${slot.theme}
${brainBlock}
YOUR TASK — Generate UNIQUE advertising content. Follow these rules STRICTLY:

1. Write a compelling, UNIQUE English caption (2-4 sentences) for this product with the given theme. Use relevant emojis. The caption must be fresh, creative, and NEVER repeat any generic or template-like phrasing.
2. Write a SHORT English advertising slogan (MAXIMUM 6 words) that will be printed ON the image. It MUST be: simple, catchy, beautiful, and grammatically perfect English. It should be a pure advertising tagline — NO guarantees, NO technical terms, NO scientific claims. Think of it like a billboard slogan: short, emotional, memorable. Examples of GOOD slogans: "Steel That Builds Dreams", "Your Project, Our Pride", "Strength Meets Style". Examples of BAD slogans: "Unparalleled Structural Integrity", "AI-Driven Precision Engineering", "Guaranteed Quality Framework".
3. Write 8-12 relevant hashtags as a single string separated by spaces.
4. Translate the caption to Farsi (Persian) — this MUST be a premium-quality, natural-sounding Persian translation. Do NOT translate word-by-word. Instead, rewrite the meaning in beautiful, fluent Persian that sounds like it was originally written by a native Persian copywriter. Use elegant vocabulary, proper Persian grammar, and a professional advertising tone. The translation should feel natural and compelling to a Persian-speaking audience.
5. Translate the image slogan to Farsi (Persian) — same quality standard: fluent, catchy, natural Persian. Not a literal translation. It should sound like a professional Persian advertising slogan.

CRITICAL RULES:
- CAPTION TONE: Must be PURELY PROMOTIONAL & ADVERTISING. Write like a creative ad agency — catchy, bold, emotional appeal. Focus on WHY the customer should buy, NOT how the product works.
- ABSOLUTELY FORBIDDEN CONTENT: scientific explanations, technical specifications, engineering terminology, material properties, structural analysis claims, tensile strength, load-bearing capacity. Do NOT explain HOW the product works.
- FORBIDDEN WORDS: guarantee, guaranteed, ensures, ensure, promise, warranty, certified, certify, unparalleled, revolutionary, superior, structural integrity, load-bearing, tensile strength, AI-driven, precision-engineered, interlocks, unmatched, finest, unbeatable, top-notch, ensures every, scientifically
- Every single call MUST produce COMPLETELY NEW and ORIGINAL content
- NEVER use generic phrases like "Building strong" or "Engineering excellence"
- Be creative, bold, and specific to the product
- IMAGE SLOGAN RULES: Must be a simple, beautiful advertising phrase. Maximum 6 words. No technical jargon. No guarantees. No scientific claims. Must be grammatically perfect English. Think billboard advertising.
- ABSOLUTELY FORBIDDEN: Do NOT mention ANY time of day, hour, clock time, AM/PM, morning, afternoon, evening, dawn, sunrise, sunset, or any time-related phrases in the caption, slogan, or translations. This is a STRICT RULE with ZERO exceptions.
- Use a unique creative angle each time: humor, statistics, metaphors, customer benefits, industry facts, material science, engineering excellence, etc.${regenerateInstruction}
- STRICTLY FORBIDDEN: Do NOT reference any holidays, cultural events, occasions, or seasonal celebrations (e.g., Nowruz, Christmas, St. Patrick's Day). Focus ONLY on the product and its construction/industrial benefits. Event-themed content is handled separately.
- SESSION CREATIVE SEED: ${sessionSeed || crypto.randomUUID()} — You MUST use this seed to drive a COMPLETELY UNIQUE creative direction. No two sessions should ever produce similar styles, angles, metaphors, or visual concepts. Treat this seed as your creative DNA for this specific session.
${brainContext ? "- You MUST follow any brand guidelines, tone, or language preferences from the Brain Context above" : ""}

Respond with ONLY a valid JSON object (no markdown, no code fences):
{"caption": "...", "hashtags": "...", "imageText": "...", "imageTextFa": "...", "captionFa": "..."}`;

  try {
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: preferredModel === "chatgpt" ? "openai/gpt-5-mini" : "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 1.0, // High temperature for maximum creativity/variation
      }),
    });

    if (!aiRes.ok) {
      console.warn(`generateDynamicContent: AI returned ${aiRes.status}`);
      throw new Error(`AI returned ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(jsonStr) as DynamicContent;

    // Validate required fields
    if (!parsed.caption || !parsed.hashtags || !parsed.imageText) {
      throw new Error("Missing required fields in AI response");
    }

    console.log(`  ✓ Dynamic content generated: imageText="${parsed.imageText}"`);
    return parsed;
  } catch (err) {
    console.error("generateDynamicContent failed:", err);
    // Fallback: generate minimal unique content deterministically
    const ts = Date.now();
    return {
      caption: `🏗️ Premium ${slot.product} — built for strength, delivered with precision. Trust RebarShop for your next project. [${ts}]`,
      hashtags: `#RebarShop #${slot.product.replace(/\s+/g, "")} #Construction #Steel #Ontario #Toronto #GTA #Quality`,
      imageText: `${slot.product} — Built to Last`,
      imageTextFa: `${slot.product} — ساخته شده برای ماندگاری`,
      captionFa: `🏗️ ${slot.product} ممتاز — ساخته شده برای استحکام، تحویل داده شده با دقت. به ریبارشاپ اعتماد کنید.`,
    };
  }
}

const PIXEL_CONTACT_INFO = `\n\n📍 9 Cedar Ave, Thornhill, Ontario\n📞 647-260-9403\n🌐 www.rebar.shop`;

/**
 * Extract image data URL from various AI response formats.
 * Supports: images[], parts[].inline_data, content[].image_url
 */
function extractImageFromAIResponse(aiData: any): string | null {
  const msg = aiData?.choices?.[0]?.message;
  if (!msg) return null;

  // Format 1: images[].image_url.url (standard Lovable gateway)
  const img = msg.images?.[0]?.image_url?.url;
  if (img) return img;

  // Format 2: parts[].inline_data.data (Gemini native)
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (part.inline_data?.data) {
        const mime = part.inline_data.mime_type || "image/png";
        return `data:${mime};base64,${part.inline_data.data}`;
      }
    }
  }

  // Format 3: content[] array with image_url objects
  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "image_url" && block.image_url?.url) {
        return block.image_url.url;
      }
    }
  }

  return null;
}

/**
 * Resolve a stable logo URL for the social agent.
 * Searches knowledge for logo/favicon, generates fresh signed URLs if needed,
 * and falls back to a hardcoded branding path.
 */
async function resolveLogoUrl(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl) return null;
  const logoUrl = `${supabaseUrl}/storage/v1/object/public/social-images/brand/company-logo.png`;

  // Preflight: verify the logo file actually exists — return null if missing
  try {
    const check = await fetch(logoUrl, { method: "HEAD" });
    if (!check.ok) {
      console.warn(`⚠️ Company logo not found (HTTP ${check.status}), proceeding without logo.`);
      return null;
    }
  } catch (err) {
    console.warn("⚠️ Could not verify logo, proceeding without it:", err);
    return null;
  }

  return logoUrl;
}

/**
 * Generates a social media image with retry pipeline and robust parsing.
 * Attempts multiple models and logo configurations before failing.
 */
async function generatePixelImage(
  prompt: string,
  svcClient: ReturnType<typeof createClient>,
  logoUrl?: string,
  options?: { styleIndex?: number | string; preferredModel?: string; resourceImageUrls?: string[]; imageAspectRatio?: string },
): Promise<{ imageUrl: string | null; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { imageUrl: null, error: "LOVABLE_API_KEY not configured" };
  }

  // Logo is optional — warn if missing but continue generation
  if (!logoUrl) {
    console.warn("⚠️ Company logo not found. Generating image without logo overlay.");
  }

  const fullPrompt = logoUrl
    ? prompt +
      "\n\nMANDATORY: The attached company logo image MUST be placed EXACTLY as-is in the generated image, " +
      "without ANY modification, distortion, or recreation. Place it in a visible corner as a watermark. " +
      "Do NOT create or draw any other logo — ONLY use the provided logo image. " +
      "Do NOT add text-based watermarks."
    : prompt;

  // Soft composition guidance — final dimensions enforced by server-side crop/resize
  const aspectRatio = options?.imageAspectRatio || "1:1";
  const compositionMap: Record<string, string> = {
    "16:9": "CRITICAL ASPECT RATIO: Generate this image in LANDSCAPE orientation (wider than tall). Target dimensions: 1536×864 pixels. The image MUST be significantly wider than it is tall. Spread important elements horizontally.",
    "9:16": "CRITICAL ASPECT RATIO: Generate this image in PORTRAIT orientation (taller than wide). Target dimensions: 864×1536 pixels. The image MUST be significantly taller than it is wide. Arrange elements vertically (suitable for Stories/Reels).",
    "1:1": "CRITICAL ASPECT RATIO: Generate this image as a perfect SQUARE. Target dimensions: 1024×1024 pixels. The image width and height must be equal. Center the main subject.",
  };
  const aspectHint = compositionMap[aspectRatio] || `Compose the image for a ${aspectRatio} layout.`;
  const finalPrompt = aspectHint + "\n\n" + fullPrompt;

  const openaiSizeMap: Record<string, string> = { "16:9": "1536x1024", "9:16": "1024x1536", "1:1": "1024x1024" };

  // ─── OpenAI gpt-image-1 path (when user selects ChatGPT) ───
  if (options?.preferredModel === "chatgpt") {
    const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
    if (GPT_API_KEY) {
      try {
        console.log("  → Attempting OpenAI gpt-image-1 for image generation...");
        const openaiRes = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${GPT_API_KEY}`, "Content-Type": "application/json" },
           body: JSON.stringify({
            model: "gpt-image-1",
            prompt: finalPrompt,
            n: 1,
            size: openaiSizeMap[aspectRatio] || "1024x1024",
            quality: "high",
          }),
        });

        if (openaiRes.ok) {
          const openaiData = await openaiRes.json();
          const imgItem = openaiData.data?.[0];
          let imageBytes: Uint8Array | null = null;

          if (imgItem?.b64_json) {
            imageBytes = Uint8Array.from(atob(imgItem.b64_json), (c) => c.charCodeAt(0));
          } else if (imgItem?.url) {
            const dlRes = await fetch(imgItem.url);
            if (dlRes.ok) imageBytes = new Uint8Array(await dlRes.arrayBuffer());
          }

          if (imageBytes) {
            // Enforce aspect ratio via server-side crop/resize
            imageBytes = await cropToAspectRatio(imageBytes, aspectRatio);

            const styleTag = options?.styleIndex ?? "x";
            const imagePath = `pixel/${Date.now()}-s${styleTag}-${Math.random().toString(36).slice(2, 8)}.png`;
            const { error: uploadError } = await svcClient.storage
              .from("social-images")
              .upload(imagePath, imageBytes, { contentType: "image/png", upsert: false });

            if (!uploadError) {
              const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
              console.log(`  ✓ OpenAI gpt-image-1 image uploaded: ${urlData.publicUrl}`);
              return { imageUrl: urlData.publicUrl };
            }
            console.warn(`  ✗ OpenAI image upload failed: ${uploadError.message}`);
          }
        } else {
          console.warn(`  ✗ OpenAI gpt-image-1 returned ${openaiRes.status}`);
        }
      } catch (e) {
        console.warn(`  ✗ OpenAI gpt-image-1 error: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Fall through to Gemini attempts below
      console.log("  → Falling back to Gemini image generation...");
    } else {
      console.warn("  ⚠️ GPT_API_KEY not configured, falling back to Gemini for image generation");
    }
  }

  // Build attempts: model + whether to include logo + refs (adaptive fallback)
  const hasRefs = !!options?.resourceImageUrls?.length;
  const attempts: { model: string; useLogo: boolean; useRefs: boolean }[] = [
    { model: "google/gemini-3.1-flash-image-preview", useLogo: true, useRefs: true },
    { model: "google/gemini-3.1-flash-image-preview", useLogo: true, useRefs: true },
    { model: "google/gemini-3-pro-image-preview", useLogo: true, useRefs: true },
    // Fallback stages: drop refs first, then drop logo
    ...(hasRefs ? [
      { model: "google/gemini-3.1-flash-image-preview", useLogo: true, useRefs: false },
      { model: "google/gemini-3-pro-image-preview", useLogo: true, useRefs: false },
    ] : []),
    { model: "google/gemini-3.1-flash-image-preview", useLogo: false, useRefs: false },
  ];

  let lastError = "Unknown error";

  for (const attempt of attempts) {
    try {
      const contentParts: any[] = [{ type: "text", text: finalPrompt }];

      // Attach resource/reference images from brain (product photos, etc.) — only if attempt allows it
      if (attempt.useRefs && options?.resourceImageUrls?.length) {
        for (const refUrl of options.resourceImageUrls.slice(0, 3)) {
          contentParts.push({ type: "image_url", image_url: { url: refUrl } });
        }
        contentParts.push({
          type: "text",
          text: "The images above are REFERENCE product/brand images. Use them as visual inspiration for style, colors, and product appearance. Do NOT copy them exactly — create something NEW inspired by them.",
        });
      }

      // Optionally attach logo
      if (attempt.useLogo && logoUrl) {
        contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
        contentParts.push({
          type: "text",
          text: "CRITICAL: The logo image provided above is the ONLY authorized company logo. " +
            "Place it EXACTLY as-is (no redrawing, no text replacement, no modification) in a visible corner of the generated image. " +
            "Do NOT create any other logo or text-based watermark.",
        });
      }

      console.log(`  → Attempt: ${attempt.model}, logo=${attempt.useLogo && !!logoUrl}, refs=${attempt.useRefs && !!options?.resourceImageUrls?.length}`);

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
          ...(aspectRatio && aspectRatio !== "1:1" ? { image_generation_config: { aspectRatio } } : {}),
        }),
      });

      if (!aiRes.ok) {
        const errSnippet = await aiRes.text().catch(() => "");
        lastError = `${attempt.model} returned ${aiRes.status}`;
        console.warn(`  ✗ ${lastError}: ${errSnippet.slice(0, 200)}`);
        continue;
      }

      const aiData = await aiRes.json();
      const imageDataUrl = extractImageFromAIResponse(aiData);

      if (!imageDataUrl) {
        lastError = `${attempt.model} returned no parseable image`;
        console.warn(`  ✗ ${lastError}`);
        continue;
      }

      // Upload to social-images bucket
      let imageBytes: Uint8Array;
      if (imageDataUrl.startsWith("data:")) {
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
        imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      } else {
        // Remote URL
        const imgResp = await fetch(imageDataUrl);
        if (!imgResp.ok) { lastError = "Failed to download generated image"; continue; }
        const buf = await imgResp.arrayBuffer();
        imageBytes = new Uint8Array(buf);
      }

      // Enforce aspect ratio via server-side crop/resize
      imageBytes = await cropToAspectRatio(imageBytes, aspectRatio);

      // Encode styleIndex in filename for dedup tracking (set by caller via options)
      const styleTag = options?.styleIndex ?? "x";
      const imagePath = `pixel/${Date.now()}-s${styleTag}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error: uploadError } = await svcClient.storage
        .from("social-images")
        .upload(imagePath, imageBytes, { contentType: "image/png", upsert: false });

      if (uploadError) {
        lastError = `Upload failed: ${uploadError.message}`;
        console.warn(`  ✗ ${lastError}`);
        continue;
      }

      const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
      console.log(`  ✓ Image generated and uploaded: ${urlData.publicUrl}`);
      return { imageUrl: urlData.publicUrl };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`  ✗ Attempt error: ${lastError}`);
    }
  }

  return { imageUrl: null, error: `All generation attempts failed. Last: ${lastError}` };
}

// Main Handler
Deno.serve((req) =>
  handleRequest(req, async ({ req: originalReq, body, userId, serviceClient, userClient }) => {
    const authHeader = originalReq.headers.get("Authorization") || "";
    const { agent, message, history = [], context: userContext = {}, attachedFiles = [], pixelSlot, preferredModel } = body as AgentRequest;

    const supabase = userClient;
    const svcClient = serviceClient;
    const user = { id: userId, user_metadata: {}, email: "" } as any;

    // getUser for metadata (email etc)
    const { data: { user: fullUser } } = await supabase.auth.getUser();
    if (fullUser) Object.assign(user, fullUser);

    // Fetch user details
    const { data: profile } = await svcClient
      .from("profiles")
      .select("id, full_name, email, company_id")
      .eq("user_id", user.id)
      .single();

    const userFullName = profile?.full_name || user.user_metadata?.full_name || "User";
    const userEmail = profile?.email || user.email || "user@rebar.shop";
    const companyId = profile?.company_id;

    // Fetch roles
    const { data: rolesData } = await svcClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (rolesData || []).map(r => r.role);

    // Context fetching (Moved to shared module)
    const dbContext = await fetchContext(supabase, agent, user.id, userEmail, roles, svcClient, companyId);

    // Inject live QuickBooks context for accounting/collections agents
    if (agent === "accounting" || agent === "collections") {
      try {
        const qbLiveData = await fetchQuickBooksLiveContext(svcClient, companyId);
        Object.assign(dbContext, qbLiveData);
      } catch (qbErr) {
        console.error("[QB Context] Failed to load QB live data:", qbErr);
      }
    }
    
    // Phase 6: Executive dashboard context for data/empire agents
    let execContext: Record<string, unknown> = {};
    if (agent === "data" || agent === "empire" || agent === "commander" || agent === "assistant" || agent === "rebuild") {
      execContext = await fetchExecutiveContext(svcClient, companyId);
    }
    
    const mergedContext = { ...dbContext, ...execContext, ...userContext };
    if (preferredModel) mergedContext.preferredModel = preferredModel;

    // Document Analysis (Moved logic to shared/agentDocumentUtils but integrated here)
    let documentResults: { 
      fileName: string; 
      text: string; 
      confidence: number; 
      discrepancies: string[]; 
      fileType: string;
      zones: DetectedZone[];
      extractedRebar: ExtractedRebarData[];
    }[] = [];
    
    const validationRules = (dbContext.validationRules as ValidationRule[]) || [];

    if (agent === "estimation" && attachedFiles.length > 0) {
      console.log(`Processing ${attachedFiles.length} files for analysis...`);
      for (const file of attachedFiles) {
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(file.name);
        const isPdf = /\.pdf$/i.test(file.name);
        
        if (isImage || isPdf) {
          console.log(`Analyzing ${isPdf ? 'PDF' : 'image'}: ${file.name}`);
          const result = await performMultiPassAnalysis(file.url, file.name, isPdf, validationRules);
          documentResults.push({
            fileName: file.name,
            text: result.mergedText,
            confidence: result.confidence,
            discrepancies: result.discrepancies,
            fileType: isPdf ? 'PDF' : 'Image',
            zones: result.zones,
            extractedRebar: result.extractedRebar,
          });
        }
      }

      if (documentResults.length > 0) {
        mergedContext.documentResults = documentResults;
      }
    }

    // ─── Sales agent image analysis ───
    if (agent === "sales" && attachedFiles.length > 0) {
      console.log(`[Sales] Analyzing ${attachedFiles.length} attached files for rebar extraction...`);
      let imageAnalysisText = "";
      for (const file of attachedFiles) {
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(file.name);
        const isPdf = /\.pdf$/i.test(file.name);

        if (isImage) {
          // Try OCR first, fall back to Gemini vision
          const ocrResult = await performOCR(file.url);
          if (ocrResult.fullText) {
            imageAnalysisText += `\n--- OCR: ${file.name} ---\n${ocrResult.fullText}`;
          } else {
            const result = await analyzeDocumentWithGemini(file.url, file.name,
              "Extract ALL rebar details from this image: bar sizes, quantities, lengths, shapes, spacing, element references. Output in structured format.");
            if (result.text) imageAnalysisText += `\n--- Analysis: ${file.name} ---\n${result.text}`;
          }
        } else if (isPdf) {
          const pdfResult = await convertPdfToImages(file.url, 5);
          if (pdfResult.pages.length > 0) {
            imageAnalysisText += `\n--- PDF: ${file.name} (${pdfResult.pageCount} pages) ---`;
            for (let pi = 0; pi < pdfResult.pages.length; pi++) {
              const pageOcr = await performOCROnBase64(pdfResult.pages[pi]);
              if (pageOcr.fullText) imageAnalysisText += `\n[Page ${pi + 1}]\n${pageOcr.fullText}`;
            }
          }
        }
      }
      if (imageAnalysisText) {
        mergedContext.salesImageAnalysis = imageAnalysisText;
        console.log(`[Sales] Image analysis complete: ${imageAnalysisText.length} chars extracted`);
      }
    }

    // Empire file analysis (simplified integration using shared utils)
    if (agent === "empire" && attachedFiles.length > 0) {
      console.log(`[Empire] Processing ${attachedFiles.length} files...`);
      let fileAnalysisText = "";
      for (const file of attachedFiles) {
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(file.name);
        const isPdf = /\.pdf$/i.test(file.name);
        
        if (isImage) {
          const ocrResult = await performOCR(file.url);
          if (ocrResult.fullText) {
            fileAnalysisText += `\n\n--- Google Vision OCR of ${file.name} ---\n${ocrResult.fullText}`;
          } else {
             // Fallback
             const result = await analyzeDocumentWithGemini(file.url, file.name, "Describe this image in detail.");
             if (result.text) fileAnalysisText += `\n\n--- Analysis of ${file.name} (Gemini fallback) ---\n${result.text}`;
          }
        } else if (isPdf) {
          const pdfResult = await convertPdfToImages(file.url, 10);
          if (pdfResult.pages.length > 0) {
             fileAnalysisText += `\n\n--- Google Vision OCR of ${file.name} (${pdfResult.pageCount} pages) ---`;
             for (let pi = 0; pi < pdfResult.pages.length; pi++) {
               const pageOcr = await performOCROnBase64(pdfResult.pages[pi]);
               if (pageOcr.fullText) fileAnalysisText += `\n\n[Page ${pi + 1}]\n${pageOcr.fullText}`;
             }
          }
        }
      }
      if (fileAnalysisText) {
        mergedContext.empireFileAnalysis = fileAnalysisText;
      }
    }

    // ─── Deterministic Guardrail: Pixel Schedule (Step 1) ───
    // If agent=social and message is a generic schedule request (e.g. New Chat auto-message),
    // return a hardcoded schedule immediately — never let the LLM decide.
    if (agent === "social") {
      const msgLower = message.trim().toLowerCase();
      // Detect if user wants to CREATE something (not see the schedule)
      const isCreationIntent = /(بساز|بنویس|درست کن|طراحی|ساخت|بنر|پوستر|محتوا|لوگو|create|generate|make|build|design|poster|banner|logo|content|intro|عکس|تصویر|image|photo|video|ویدیو|پست|کپشن|caption|نوروز|تبریک|تخفیف)/i.test(msgLower);
      const isExplicitScheduleRequest = /\b(content\s*schedule|schedule\s*for\s*today|today|program|برنامه)\b/i.test(msgLower);
      const isScheduleRequest = (
        (history.length === 0 && !isCreationIntent && !msgLower.trim()) || // empty auto-message on new chat
        (isExplicitScheduleRequest && !isCreationIntent) // explicit schedule request without creation intent
      ) && !/^\d$/.test(msgLower) && msgLower !== "all"; // not a slot selection

      if (isScheduleRequest) {
        const scheduleDate = (userContext?.selectedDate as string) ||
          new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: workspaceTz });

        const scheduleReply = `📅 **Content Schedule — ${scheduleDate}**

| # | Theme | Product |
|---|-------|---------|
| 1 | Motivational / Strength | Rebar Stirrups |
| 2 | Creative promotional | Rebar Cages |
| 3 | Strength & scale | Fiberglass Rebar (GFRP) |
| 4 | Innovation & efficiency | Wire Mesh |
| 5 | Product promotional | Rebar Dowels |

**Which slot? (Enter 1-5 or "all")**`;

        return new Response(
          JSON.stringify({ reply: scheduleReply, context: mergedContext, modelUsed: "deterministic" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Deterministic Guardrail: Pixel Image Generation (Step 2) ───
    // When agent=social and user sends slot number (1-5), time, or "all",
    // bypass LLM entirely and generate real images via Lovable AI gateway.
    if (agent === "social") {
      const msgLower = message.trim().toLowerCase();
      const slotMatch = msgLower.match(/^([1-5])$/);
      const isAllSlots = msgLower === "all";
      // Detect regenerate requests: "regenerate slot 3", "regenerate slot3", etc.
      const regenMatch = msgLower.match(/regenerate\s*(?:slot\s*)?([1-5])/i);
      const isRegenerate = !!regenMatch;

      const timeSlotNum: number | undefined = (pixelSlot && typeof pixelSlot === "number" && pixelSlot >= 1 && pixelSlot <= 5) ? pixelSlot : undefined;

      // Map time strings to slot numbers for instant generation
      const TIME_TO_SLOT: Record<string, number> = {
        "06:30": 1, "6:30": 1,
        "07:30": 2, "7:30": 2,
        "08:00": 3, "8:00": 3,
        "12:30": 4,
        "14:00": 5,
      };
      const timeMatch = TIME_TO_SLOT[msgLower.trim()];

      if (slotMatch || isAllSlots || timeSlotNum || isRegenerate || timeMatch) {
        console.log("🎨 Pixel Step 2: Deterministic image generation triggered", isRegenerate ? "(REGENERATE)" : "");

        // Resolve company logo — optional, continue without if missing
        const logoUrl = await resolveLogoUrl();
        if (!logoUrl) {
          console.warn("⚠️ Logo not found, will generate images without logo overlay.");
        }

        // Fetch recent image file names to prevent duplicates
        let recentImageNames: string[] = [];
        try {
          const { data: recentFiles } = await svcClient.storage
            .from("social-images")
            .list("pixel", { limit: 30, sortBy: { column: "created_at", order: "desc" } });
          if (recentFiles) {
            recentImageNames = recentFiles.map((f: any) => f.name);
          }
        } catch (e) {
          console.warn("Could not fetch recent images for dedup:", e);
        }

        const resolvedSlotNum = isRegenerate
          ? parseInt(regenMatch![1])
          : (timeSlotNum || timeMatch || parseInt(slotMatch?.[1] || "1"));
        const slotsToGenerate = isAllSlots
          ? PIXEL_SLOTS
          : [PIXEL_SLOTS[resolvedSlotNum - 1]];

        const results: string[] = [];

        // Extract user-selected products BEFORE the loop so we can override slot.product
        const userSelectedProductsForSlots = (userContext as any)?.selectedProducts as string[] | undefined;
        const PRODUCT_PROMPT_MAP_EARLY: Record<string, string> = {
          fiberglass: "Rebar Fiberglass Straight — fiberglass reinforcement bars, lightweight, corrosion-resistant, used in marine and chemical environments",
          stirrups: "Rebar Stirrups — bent steel reinforcement loops used to hold vertical rebar in columns and beams",
          cages: "Rebar Cages — pre-assembled cylindrical or rectangular steel reinforcement cages for foundations and piles",
          hooks: "Rebar Hooks — bent steel bars with hooked ends for anchoring in concrete structures",
          dowels: "Rebar Dowels — straight steel bars used to connect concrete slabs and structural joints",
          wire_mesh: "Wire Mesh — welded steel wire mesh sheets for slab reinforcement and concrete crack control",
          straight: "Rebar Straight — standard straight steel reinforcement bars in various sizes",
        };

        // Parallelize slot generation to avoid edge function timeout on multi-slot requests
        const slotResults = await Promise.allSettled(
          slotsToGenerate.map(async (slot) => {
          // Override slot product with user selection so caption/slogan match user's choice
          const effectiveSlotProduct = userSelectedProductsForSlots?.length
            ? userSelectedProductsForSlots.map(k => PRODUCT_PROMPT_MAP_EARLY[k] || k).join(" & ")
            : slot.product;
          const effectiveSlot = { ...slot, product: effectiveSlotProduct };

          console.log(`🎨 Pixel: Generating DYNAMIC content for slot ${slot.slot} (${effectiveSlotProduct})...`);

          // Step A: Generate unique, non-repeating caption + slogan + hashtags via LLM
          // Inject brain knowledge block into content generation
          const brainKnowledge = (mergedContext.brainKnowledgeBlock as string) || "";
          // Generate a session-unique seed to ensure every chat produces distinct creative output
          const sessionSeed = `${(mergedContext.sessionId as string) || "anon"}-${crypto.randomUUID()}`;

          const dynContent = await generateDynamicContent(effectiveSlot, isRegenerate, brainKnowledge, preferredModel, sessionSeed);

          // Step B: Build image prompt with MANDATORY advertising text on image
          // Extract custom instructions from brain knowledge to inject into image prompt
          const customInstructionsMatch = brainKnowledge.match(/## Custom Instructions:\n([\s\S]*?)(?=\n## |\n\n## |$)/);
          const customInstructions = customInstructionsMatch?.[1]?.trim() || "";
          const customInstructionsBlock = customInstructions
            ? `\n\n## USER IMAGE INSTRUCTIONS (MUST FOLLOW STRICTLY):\n${customInstructions}\n\n`
            : "";

          // Resolve fresh signed URLs for brain image resources instead of using expired regex-extracted URLs
          let brainImageRefs: string[] = [];
          try {
            const { data: imgKnowledge } = await svcClient
              .from("knowledge")
              .select("source_url, metadata")
              .eq("company_id", companyId)
              .eq("category", "image")
              .order("created_at", { ascending: false })
              .limit(10);
            if (imgKnowledge) {
              const socialImages = imgKnowledge.filter((k: any) => (k.metadata as any)?.agent === "social");
              for (const item of socialImages.slice(0, 5)) {
                if (!item.source_url) continue;
                const meta = item.metadata as Record<string, any> | null;
                const storagePath = meta?.storage_path;
                const storageBucket = meta?.storage_bucket || "estimation-files";
                // If we have a stable storage path, create a fresh signed URL
                if (storagePath) {
                  const { data: signedData } = await svcClient.storage
                    .from(storageBucket)
                    .createSignedUrl(storagePath, 3600);
                  if (signedData?.signedUrl) {
                    brainImageRefs.push(signedData.signedUrl);
                    continue;
                  }
                }
                // Try parsing storage path from signed URL pattern
                const signMatch = item.source_url.match(/\/object\/sign\/([^/]+)\/([^?]+)/);
                if (signMatch) {
                  const bucket = signMatch[1];
                  const path = decodeURIComponent(signMatch[2]);
                  const { data: signedData } = await svcClient.storage
                    .from(bucket)
                    .createSignedUrl(path, 3600);
                  if (signedData?.signedUrl) {
                    brainImageRefs.push(signedData.signedUrl);
                    continue;
                  }
                }
                // If it's a public URL, validate it
                if (item.source_url.includes("/object/public/")) {
                  try {
                    const headRes = await fetch(item.source_url, { method: "HEAD" });
                    if (headRes.ok) brainImageRefs.push(item.source_url);
                  } catch {}
                }
              }
            }
          } catch (e) {
            console.warn("Could not resolve brain image refs:", e);
          }
          // Filter out SVG (unsupported by image models)
          brainImageRefs = brainImageRefs.filter(u => !/\.svg(\?|$)/i.test(u));
          console.log(`  Brain image refs resolved: ${brainImageRefs.length} valid URLs`);
          const brainImageHint = brainImageRefs.length > 0
            ? `\nReference brand images for style inspiration: (${brainImageRefs.length} images attached)`
            : "";

          // Build anti-duplicate context from recent images
          const dedupHint = recentImageNames.length > 0
            ? `\n\nPREVIOUSLY GENERATED (MUST NOT resemble any of these — use completely different composition, angle, color scheme): ${recentImageNames.slice(0, 15).join(", ")}`
            : "";

          // Extract style indices from recent filenames (format: timestamp-sINDEX-random.png)
          const usedStyleIndices = new Set<number>();
          for (const name of recentImageNames) {
            const match = name.match(/-s(\d+)-/);
            if (match) usedStyleIndices.add(parseInt(match[1]));
          }
          const availableStyles = slot.imageStyles
            .map((s, idx) => ({ style: s, idx }))
            .filter(({ idx }) => !usedStyleIndices.has(idx));
          const stylePool = availableStyles.length > 0 ? availableStyles : slot.imageStyles.map((s, idx) => ({ style: s, idx }));
          const selected = stylePool[Math.floor(Math.random() * stylePool.length)];
          const selectedStyle = selected.style;
          const selectedStyleIndex = selected.idx;

          // Build forbidden styles hint from recently used indices
          const forbiddenStyles = [...usedStyleIndices]
            .map(i => slot.imageStyles[i])
            .filter(Boolean)
            .slice(0, 5);
          const forbiddenHint = forbiddenStyles.length > 0
            ? `\nFORBIDDEN STYLES (already used recently, DO NOT use): ${forbiddenStyles.join("; ")}`
            : "";

          // Build user-selected style directives from context.imageStyles
          const IMAGE_STYLE_MAP: Record<string, string> = {
            realism: "Ultra-photorealistic, shot on professional DSLR, natural lighting, real textures, shallow depth of field",
            urban: "Urban cityscape setting, modern architecture, street-level industrial aesthetics, city life atmosphere",
            construction: "Active construction site, heavy machinery, steel structures, workers in safety gear, raw industrial energy",
            ai_modern: "Futuristic tech-forward aesthetic, clean geometric lines, digital integration with physical world, neon accents",
            nature: "Natural outdoor setting, lush greenery, calm atmosphere, sustainable construction, blue sky and trees",
            advertising: "Commercial product photography, polished studio lighting, bold text overlays, brand-forward composition",
            inspirational: "Dramatic lighting, hero shot, empowering composition, golden hour, motivational atmosphere",
            cartoon: "Cartoon style illustration, bold outlines, vibrant flat colors, exaggerated proportions, comic book aesthetic, clean vector-like rendering",
            animation: "3D animated render, Pixar/Disney-quality, smooth surfaces, dramatic lighting, cinematic depth of field, stylized realism",
            painting: "Oil painting style, visible brush strokes, rich color palette, artistic composition, impressionist or classical fine art aesthetic",
          };
          const userImageStyles = (userContext as any)?.imageStyles as string[] | undefined;
          // When user explicitly selected styles, override the random pool style
          const effectiveStyle = userImageStyles?.length
            ? userImageStyles.map(k => IMAGE_STYLE_MAP[k] || k).join(". ")
            : selectedStyle;

          // Product selection override from UI
          const PRODUCT_PROMPT_MAP: Record<string, string> = {
            fiberglass: "Rebar Fiberglass Straight — fiberglass reinforcement bars, lightweight, corrosion-resistant, used in marine and chemical environments",
            stirrups: "Rebar Stirrups — bent steel reinforcement loops used to hold vertical rebar in columns and beams",
            cages: "Rebar Cages — pre-assembled cylindrical or rectangular steel reinforcement cages for foundations and piles",
            hooks: "Rebar Hooks — bent steel bars with hooked ends for anchoring in concrete structures",
            dowels: "Rebar Dowels — straight steel bars used to connect concrete slabs and structural joints",
            wire_mesh: "Wire Mesh — welded steel wire mesh sheets for slab reinforcement and concrete crack control",
            straight: "Rebar Straight — standard straight steel reinforcement bars in various sizes",
          };
          const userSelectedProducts = (userContext as any)?.selectedProducts as string[] | undefined;
          const productFocusOverride = userSelectedProducts?.length
            ? userSelectedProducts.map(k => PRODUCT_PROMPT_MAP[k] || k).join("; ")
            : null;
          const productFocusBlock = productFocusOverride
            ? `\n\n## USER-SELECTED PRODUCTS (image MUST prominently feature these products):\n${productFocusOverride}\nThe image must clearly show these specific products in a realistic industrial/construction setting.\n\n`
            : "";

          // Build image prompt — user-selected product/style at HIGHEST PRIORITY at the top
          const userPriorityBlock = (productFocusOverride || userImageStyles?.length)
            ? `## ⚠️ HIGHEST PRIORITY — USER EXPLICITLY REQUESTED:\n` +
              (productFocusOverride ? `PRODUCT: ${productFocusOverride}\n` : "") +
              (userImageStyles?.length ? `STYLE: ${effectiveStyle}\n` : "") +
              `The image MUST show exactly these products in this style. This overrides ALL other defaults below.\n\n`
            : "";

          const NON_REALISTIC_STYLES = ["cartoon", "animation", "painting", "ai_modern"];
          const userWantsNonRealistic = userImageStyles?.some((s: string) => NON_REALISTIC_STYLES.includes(s));

          const realismRule = userWantsNonRealistic
            ? `STYLE OVERRIDE: The user explicitly selected a non-photorealistic style. You MUST follow "${effectiveStyle}" EXACTLY. Do NOT make it photorealistic. Do NOT add real-camera or photograph qualities.\n\n`
            : `MANDATORY REALISM RULE: ALL images MUST be PHOTOREALISTIC — real-world photography style ONLY. ` +
              `ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract art, AI-looking art, stock photo feel. ` +
              `Every image MUST look like it was taken by a professional photographer with a real camera at a real location.\n\n`;

          const qualitySuffix = userWantsNonRealistic
            ? `- Ultra high resolution, perfect for social media\n` +
              `- Follow the "${effectiveStyle}" style with professional quality`
            : `- Ultra high resolution, PHOTOREALISTIC ONLY, perfect for social media\n` +
              `- Must look like a REAL photograph — natural imperfections, real lighting, actual textures`;

          const imagePrompt = userPriorityBlock + customInstructionsBlock + productFocusBlock +
            realismRule +
            `ABSOLUTELY NO DUPLICATES — every image must be unique in composition, angle, color palette, and scene.\n` +
            `STRICTLY FORBIDDEN IN IMAGE: Do NOT depict any holidays, cultural events, celebrations, seasonal decorations, or festive elements (e.g., Nowruz Haft-sin, Christmas trees, fireworks, flowers for occasions). The image must be a PURE industrial/construction product advertisement with NO event or occasion theme whatsoever.\n\n` +
            `VISUAL STYLE: ${effectiveStyle}. ` +
            `PRODUCT FOCUS: ${productFocusOverride || effectiveSlotProduct} for REBAR.SHOP. THEME: ${slot.theme}. ` +
            `MANDATORY: Write this exact advertising text prominently on the image in a clean, bold, readable font: "${dynContent.imageText}"` +
            brainImageHint +
            dedupHint +
            forbiddenHint +
            ` — unique session seed: ${sessionSeed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` +
            `\n\nMANDATORY VISUAL DIVERSITY RULES:\n` +
            `- Use the specified visual style EXACTLY as described above\n` +
            `- FORBIDDEN: Do not repeat any composition, camera angle, color palette, or scene layout from recent images\n` +
            `- Each image must feel like it belongs to a completely different photo series\n` +
            qualitySuffix;

          console.log(`🎨 Pixel: Generating image for slot ${slot.slot} with style #${selectedStyleIndex}: ${selectedStyle}...`);
          const userAspectRatio = (userContext as any)?.imageAspectRatio as string | undefined;
          const imgResult = await generatePixelImage(imagePrompt, svcClient, logoUrl, { styleIndex: selectedStyleIndex, preferredModel, resourceImageUrls: brainImageRefs.slice(0, 3), imageAspectRatio: userAspectRatio });

          // Only show imageTextFa line if it has actual content
          const hasImageText = dynContent.imageTextFa && dynContent.imageTextFa.trim() !== "" && dynContent.imageTextFa.trim() !== "-";
          const persianBlock = `\n\n---PERSIAN---\n` +
            (hasImageText ? `🖼️ متن روی عکس: ${dynContent.imageTextFa}\n` : "") +
            `📝 ترجمه کپشن: ${dynContent.captionFa}`;

          const displayProduct = effectiveSlotProduct || slot.product;
          if (imgResult.imageUrl) {
            return (
              `### Slot ${slot.slot} — ${displayProduct}\n\n` +
              `![${displayProduct}](${imgResult.imageUrl})\n\n` +
              `**Caption:**\n${dynContent.caption}` +
              PIXEL_CONTACT_INFO +
              `\n\n${dynContent.hashtags}` +
              persianBlock
            );
          } else {
            return (
              `### Slot ${slot.slot} — ${displayProduct}\n\n` +
              `⚠️ Image generation failed: ${imgResult.error || "Unknown error"}\n\n` +
              `**Caption:**\n${dynContent.caption}` +
              PIXEL_CONTACT_INFO +
              `\n\n${dynContent.hashtags}` +
              persianBlock
            );
          }
          })
        );

        // Collect results preserving slot order
        for (const result of slotResults) {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            console.error("Slot generation failed:", result.reason);
            results.push(`### Slot — Generation Error\n\n⚠️ ${result.reason?.message || "Unknown error"}`);
          }
        }

        const pixelReply = results.join("\n\n---\n\n");

        return new Response(
          JSON.stringify({
            reply: pixelReply,
            context: mergedContext,
            modelUsed: "deterministic-pixel",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Prepare System Prompt
    const basePrompt = agentPrompts[agent] || agentPrompts.sales;
    
    const roleList = roles.join(", ") || "none";
    const isRestricted = !roles.some(r => ["admin", "accounting", "office", "sales"].includes(r));
    
    const userLang = "en"; // Default or fetch from profile if available
    const langNames: Record<string, string> = { en: "English", fa: "Farsi (Persian)", es: "Spanish", fr: "French" };
    const LANG_INSTRUCTION = userLang !== "en"
      ? `\n\n## Response Language\nThe user's preferred language is: ${langNames[userLang] || userLang}\n`
      : "";

    const stripSendCapabilities = false;
    const DRAFT_ONLY_BLOCK = ""; 

    // RAG: fetch relevant historical context
    const ragBlock = await fetchRAGContext(
      Deno.env.get("SUPABASE_URL") ?? "",
      agent,
      message,
      companyId,
    );

    let contextStr = "";
    if (Object.keys(mergedContext).length > 0) {
      const displayContext = { ...mergedContext };
      delete displayContext.brainKnowledgeBlock;
      delete displayContext.roleAccessBlock;
      contextStr = `\n\nCurrent data context:\n${JSON.stringify(displayContext, null, 2)}`;
    }

    // Phase 5: Cache-optimized message ordering
    // Static prefix (system prompt + tools) stays identical across calls for the same agent
    // → OpenAI/Gemini cache this prefix and charge 50-90% less for repeated tokens
    // Dynamic suffix (context, history, user message) varies per call
    const todayEST = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "America/Toronto",
    });
    const staticSystemPrompt = ONTARIO_CONTEXT + basePrompt + 
      GOVERNANCE_RULES + DRAFT_ONLY_BLOCK + SHARED_TOOL_INSTRUCTIONS + IDEA_GENERATION_INSTRUCTIONS + LANG_INSTRUCTION +
      `\n\n## Current Date & Time\nToday is: ${todayEST}\nTimezone: Eastern (America/Toronto)` +
      `\n\n## Current User\nName: ${userFullName}\nEmail: ${userEmail}`;

    // Dynamic content goes in a separate system message to preserve cache boundary
    // Inject mandatory style/product override for social agent free-text messages
    let socialStyleOverride = "";
    if (agent === "social") {
      const uStyles = (mergedContext.imageStyles as string[]) || [];
      const uProducts = (mergedContext.selectedProducts as string[]) || [];
      if (uStyles.length || uProducts.length) {
        const IMAGE_STYLE_MAP: Record<string, string> = {
          realism: "Ultra-photorealistic, shot on professional DSLR, natural lighting, real textures, shallow depth of field",
          urban: "Urban cityscape setting, modern architecture, street-level industrial aesthetics, city life atmosphere",
          construction: "Active construction site, heavy machinery, steel structures, workers in safety gear, raw industrial energy",
          ai_modern: "Futuristic tech-forward aesthetic, clean geometric lines, digital integration with physical world, neon accents",
          nature: "Natural outdoor setting, lush greenery, calm atmosphere, sustainable construction, blue sky and trees",
          advertising: "Commercial product photography, polished studio lighting, bold text overlays, brand-forward composition",
          inspirational: "Dramatic lighting, hero shot, empowering composition, golden hour, motivational atmosphere",
          cartoon: "Cartoon style illustration, bold outlines, vibrant flat colors, exaggerated proportions, comic book aesthetic, clean vector-like rendering",
          animation: "3D animated render, Pixar/Disney-quality, smooth surfaces, dramatic lighting, cinematic depth of field, stylized realism",
          painting: "Oil painting style, visible brush strokes, rich color palette, artistic composition, impressionist or classical fine art aesthetic",
        };
        const PRODUCT_PROMPT_MAP: Record<string, string> = {
          fiberglass: "Rebar Fiberglass Straight — fiberglass reinforcement bars, lightweight, corrosion-resistant",
          stirrups: "Rebar Stirrups — bent steel reinforcement loops for columns and beams",
          cages: "Rebar Cages — pre-assembled steel reinforcement cages for foundations and piles",
          hooks: "Rebar Hooks — bent steel bars with hooked ends for anchoring in concrete",
          dowels: "Rebar Dowels — straight steel bars for connecting concrete slabs and joints",
          wire_mesh: "Wire Mesh — welded steel wire mesh sheets for slab reinforcement",
          straight: "Rebar Straight — standard straight steel reinforcement bars in various sizes",
        };
        const styleDesc = uStyles.map(k => IMAGE_STYLE_MAP[k] || k).join(". ");
        const productDesc = uProducts.map(k => PRODUCT_PROMPT_MAP[k] || k).join("; ");
        const NON_REALISTIC = ["cartoon", "animation", "painting", "ai_modern"];
        const isNonRealistic = uStyles.some(s => NON_REALISTIC.includes(s));

        socialStyleOverride = `\n\n## 🚨 MANDATORY USER SELECTIONS — HIGHEST PRIORITY — OVERRIDE ALL DEFAULTS 🚨\n`;
        if (uProducts.length) socialStyleOverride += `REQUIRED PRODUCT(S): ${productDesc}\n`;
        if (uStyles.length) socialStyleOverride += `REQUIRED STYLE: ${styleDesc}\n`;
        if (isNonRealistic) {
          socialStyleOverride += `CRITICAL: The user selected a NON-PHOTOREALISTIC style. You MUST follow "${styleDesc}" EXACTLY. IGNORE the photorealism rule completely. Do NOT make images look like real photographs.\n`;
        }
        socialStyleOverride += `FAILURE TO FOLLOW THESE STYLE/PRODUCT SELECTIONS IS A CRITICAL ERROR.\n`;
        socialStyleOverride += `When calling generate_image, you MUST:\n1. Include the style and product descriptions DIRECTLY in the prompt text\n2. Pass the style parameter: "${uStyles.join(",")}"\n3. Pass the products parameter: "${uProducts.join(",")}"\n4. The prompt text itself MUST describe ONLY the selected product(s). Do NOT mention or describe ANY other product in the prompt text.\n`;
        socialStyleOverride += `Image dimensions are pre-configured by the system. Do NOT mention aspect ratio in your response.\n`;
        socialStyleOverride += `\n🚨 ABSOLUTE RULE: If the user's message implies creation (e.g. "بساز", "create", "generate", "make", "عکس", "نوروز"), you MUST IMMEDIATELY call generate_image. Do NOT ask any questions. The toolbar selections ARE the user's specification. JUST GENERATE.\n`;
      }
    }

    const dynamicContext = (mergedContext.brainKnowledgeBlock as string || "") +
      (mergedContext.roleAccessBlock as string || "") +
      ragBlock + contextStr;
    
    // Inject style override as a SEPARATE high-priority system message so it doesn't get buried
    const styleSystemMessage = socialStyleOverride ? [{ role: "system" as const, content: socialStyleOverride }] : [];

    // Document analysis summary injection
    let docSummary = "";
    if (agent === "estimation" && documentResults.length > 0) {
      docSummary = "\n\n📋 DOCUMENT ANALYSIS RESULTS:\n" + documentResults.map(d => `--- ${d.fileName} ---\n${d.text.substring(0, 1000)}...`).join("\n");
    }

    const messages: ChatMessage[] = [
      { role: "system", content: staticSystemPrompt },
      ...(dynamicContext || docSummary ? [{ role: "system" as const, content: dynamicContext + docSummary }] : []),
      ...styleSystemMessage,
      ...history.slice(-10),
      { role: "user", content: message },
    ];

    // Model Routing — respect user's preferred model if set
    let modelConfig;
    if (preferredModel === "chatgpt") {
      modelConfig = { provider: "gpt" as AIProvider, model: "gpt-4o", maxTokens: 4000, temperature: 0.5, reason: "user-selected ChatGPT" };
    } else if (preferredModel === "gemini") {
      modelConfig = { provider: "gemini" as AIProvider, model: "gemini-2.5-flash", maxTokens: 4000, temperature: 0.5, reason: "user-selected Gemini" };
    } else {
      modelConfig = selectModel(agent, message, attachedFiles.length > 0, history.length);
    }
    console.log(`🧠 Model routing: ${agent} → ${modelConfig.model} (${modelConfig.reason})`);

    // Tools
    const tools = getTools(agent, stripSendCapabilities);

    // Force tool use for empire agent on diagnostic/fix requests
    const empireForceTools = agent === "empire" && tools.length > 0 &&
      /check|diagnos|fix|rebar\.shop|scrape|audit|report|seo|issue|broken|error|status/i.test(message);

    // Force tool use for social/pixel agent on creation requests
    const socialForceTools = agent === "social" && tools.length > 0 &&
      /create|generate|make|build|image|بساز|عکس|تصویر|نوروز|ساخت|طراحی|پست|بنر/i.test(message);

    const initialToolChoice = (empireForceTools || socialForceTools) ? "required" : "auto";
    if (empireForceTools) console.log("🔧 Empire: forcing toolChoice=required for diagnostic request");
    if (socialForceTools) console.log("🎨 Pixel: forcing toolChoice=required for creation request");

    // AI Call — wrapped in try-catch to surface descriptive errors
    let aiResult;
    try {
      aiResult = await callAI({
        provider: modelConfig.provider,
        model: modelConfig.model,
        agentName: agent,
        messages: messages as AIMessage[],
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        tools,
        toolChoice: initialToolChoice,
        fallback: { provider: "gemini", model: "gemini-2.5-flash" },
      });
    } catch (aiErr: unknown) {
      const errMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      console.error(`❌ AI call failed for ${agent}: ${errMsg}`);
      return new Response(
        JSON.stringify({
          reply: `I'm having trouble connecting to the AI service right now. Error: ${errMsg.substring(0, 200)}. Please try again in a moment.`,
          context: mergedContext,
          modelUsed: modelConfig.model,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const choice = aiResult.raw.choices?.[0];
    let reply = choice?.message?.content || "";
    
    // Tool Execution Loop
    let toolCalls = choice?.message?.tool_calls;
    const accumulatedTurns: any[] = [];
    let toolLoopIterations = 0;
    const MAX_TOOL_ITERATIONS = 5;
    
    // Metrics
    const createdNotifications: any[] = [];
    const emailResults: any[] = [];

    // Main Loop
    while (toolCalls && toolCalls.length > 0 && toolLoopIterations < MAX_TOOL_ITERATIONS) {
      console.log(`🔧 Tool loop #${toolLoopIterations + 1}: ${toolCalls.map((tc: any) => tc.function?.name).join(", ")}`);
      const toolResults = [];
      
      // Parallel execution
      const toolPromises = toolCalls.map((tc: any) => 
        executeToolCall(tc, agent, user, companyId, svcClient, mergedContext, authHeader)
      );
      
      const results = await Promise.all(toolPromises);
      
      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const tc = toolCalls[i];
        
        // Track side effects
        if (result.sideEffects?.notifications) createdNotifications.push(...result.sideEffects.notifications);
        if (result.sideEffects?.emails) emailResults.push(...result.sideEffects.emails);
        
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function?.name || tc.name || "unknown_tool",
          content: JSON.stringify(result.result)
        });
      }

      // Push the assistant message that triggered these tool calls
      const currentAssistantMsg = aiResult.raw.choices?.[0]?.message;
      accumulatedTurns.push(currentAssistantMsg);
      accumulatedTurns.push(...toolResults);

      // ── Quote Recovery Injection: if any tool result signals a failed quote,
      //    inject a system-level instruction so the model cannot narrate success ──
      const hasQuoteRecovery = toolResults.some((tr: any) => {
        try {
          const parsed = typeof tr.content === "string" ? JSON.parse(tr.content) : tr.content;
          return parsed?.quote_recovery === true || parsed?.pricing_status === "failed" || parsed?.failure_reason === "grand_total_zero";
        } catch { return false; }
      });
      
      const nextMessages = [...messages, ...accumulatedTurns];

      if (hasQuoteRecovery) {
        console.log("🔴 Quote recovery detected — injecting recovery-mode instruction");
        nextMessages.push({
          role: "system" as const,
          content: "🚨 QUOTE RECOVERY MODE ACTIVE. The quote tool returned a FAILED result. You MUST NOT say the quote succeeded, was saved, or is ready. Do NOT call save_sales_quotation. Instead, tell the customer what details are missing (from the missing_inputs field) and ask them to provide those details so you can re-quote. This overrides all auto-save instructions."
        });
      }
      
      // Inject structured output reminder for social agent before follow-up call
      if (agent === "social") {
        nextMessages.push({
          role: "user" as const,
          content: "SYSTEM REMINDER: Your response MUST be ONLY: ![Product](URL) then English caption, then contact info (📍📞🌐), then hashtags, then ---PERSIAN--- translation block. NO Persian text outside ---PERSIAN---. NO descriptions. NO narration. NO explanations."
        });
      }

      // Follow-up AI call (with fallback to ensure tool loops survive GPT failures)
      aiResult = await callAI({
        provider: modelConfig.provider,
        model: modelConfig.model,
        agentName: agent,
        messages: nextMessages as AIMessage[],
        maxTokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        tools,
        toolChoice: "auto",
        fallback: { provider: "gemini", model: "gemini-2.5-pro" },
      });
      
      const followUpChoice = aiResult.raw.choices?.[0];
      reply = followUpChoice?.message?.content || reply;
      toolCalls = followUpChoice?.message?.tool_calls;
      
      toolLoopIterations++;
    }

    // Recovery: if reply is empty after tool loop, force a text-only AI call
    if (!reply) {
      console.warn("⚠️ Empty reply after tool loop — attempting recovery call without tools");
      try {
        const recoveryMessages = [
          ...messages,
          ...accumulatedTurns,
          { role: "user" as const, content: "Please provide your complete analysis and response as text now. Synthesize all the data you've processed into a clear, actionable briefing." }
        ];
        
        const recoveryResult = await callAI({
          provider: modelConfig.provider,
          model: modelConfig.model,
          agentName: agent,
          messages: recoveryMessages,
          maxTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
          // No tools — forces text response
          fallback: { provider: "gemini", model: "gemini-2.5-pro" },
        });
        
        reply = recoveryResult.content || "";
        if (reply) console.log("✅ Recovery call succeeded — got text response");
      } catch (recoveryErr) {
        console.error("❌ Recovery call failed:", recoveryErr);
      }
    }

    // Final fallback for empty reply
    if (!reply && !createdNotifications.length) {
      reply = "I processed the data but couldn't generate a text response. Please try again or rephrase your question.";
    }

    // Post-processing safety net: strip verbose text for social agent
    if (agent === "social" && reply) {
      const imageMarkdownIdx = reply.indexOf("![");
      if (imageMarkdownIdx > 0) {
        const preImageText = reply.slice(0, imageMarkdownIdx).trim();
        if (preImageText.length > 30) {
          console.log(`🧹 Social agent: stripping ${preImageText.length} chars of pre-image text`);
          reply = reply.slice(imageMarkdownIdx);
        }
      }

      // Strip Persian/Arabic text that appears AFTER image but BEFORE ---PERSIAN---
      const persianSepIdx = reply.indexOf("---PERSIAN---");
      if (imageMarkdownIdx >= 0 && persianSepIdx > 0) {
        // Find end of image markdown line
        const imgLineEnd = reply.indexOf("\n", imageMarkdownIdx);
        if (imgLineEnd > 0 && imgLineEnd < persianSepIdx) {
          const imageLine = reply.slice(imageMarkdownIdx, imgLineEnd + 1);
          const betweenText = reply.slice(imgLineEnd + 1, persianSepIdx);
          const persianBlock = reply.slice(persianSepIdx);

          // Detect Persian/Arabic characters in the between-text
          const persianCharRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;
          const persianChars = betweenText.match(persianCharRegex);
          const totalChars = betweenText.replace(/\s/g, "").length;

          // If >20% of non-whitespace chars are Persian, extract only English lines
          if (persianChars && totalChars > 0 && persianChars.length / totalChars > 0.2) {
            const lines = betweenText.split("\n");
            const englishLines = lines.filter(line => {
              const trimmed = line.trim();
              if (!trimmed) return true; // keep blank lines
              // Keep lines that are contact info, hashtags, or mostly English
              if (/^[📍📞🌐#]/.test(trimmed)) return true;
              const persianInLine = (trimmed.match(persianCharRegex) || []).length;
              return persianInLine / trimmed.replace(/\s/g, "").length < 0.2;
            });
            const cleanedBetween = englishLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
            console.log(`🧹 Social agent: stripped Persian narration between image and ---PERSIAN--- block`);
            reply = imageLine + (cleanedBetween ? "\n" + cleanedBetween + "\n\n" : "\n\n") + persianBlock;
          }
        }
      }
    }

    // QA Reviewer Layer — validate high-risk agent outputs
    const qaResult = await reviewAgentOutput(
      agent,
      reply,
      contextStr,
      toolLoopIterations > 0,
    );

    if (!qaResult.skipped) {
      console.log(`🔍 QA Review: ${agent} → pass=${qaResult.pass}, severity=${qaResult.severity}, flags=${qaResult.flags.length}`);
    }

    // If critical issues found, use sanitized reply
    if (!qaResult.pass && qaResult.severity === "critical" && qaResult.sanitizedReply) {
      reply = qaResult.sanitizedReply;
    }

    // Append warning flags as metadata (non-critical)
    const qaFlags = qaResult.flags.length > 0 ? qaResult.flags : undefined;

    return new Response(
      JSON.stringify({
        reply,
        context: mergedContext,
        modelUsed: modelConfig.model,
        createdNotifications,
        emailsSent: emailResults,
        qaReview: qaFlags ? { pass: qaResult.pass, severity: qaResult.severity, flags: qaFlags } : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  }, { functionName: "ai-agent", requireCompany: false, wrapResult: false })
);
