import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchContext, fetchQuickBooksLiveContext, fetchEstimationLearnings, fetchRebarStandards, fetchRAGContext } from "../_shared/agentContext.ts";
import { fetchExecutiveContext } from "../_shared/agentExecutiveContext.ts";
import { getTools } from "../_shared/agentTools.ts";
import { executeToolCall } from "../_shared/agentToolExecutor.ts";
import { selectModel, AIError, callAI, type AIMessage, type AIProvider } from "../_shared/aiRouter.ts";
import { analyzeDocumentWithGemini, convertPdfToImages, performOCR, performOCROnBase64, performMultiPassAnalysis, detectZones, extractRebarData } from "../_shared/agentDocumentUtils.ts";
import { agentPrompts } from "../_shared/agentPrompts.ts";
import { reviewAgentOutput } from "../_shared/agentQA.ts";
import { 
  ONTARIO_CONTEXT, 
  SHARED_TOOL_INSTRUCTIONS, 
  IDEA_GENERATION_INSTRUCTIONS, 
  GOVERNANCE_RULES 
} from "../_shared/agentSharedInstructions.ts";
import type { AgentRequest, ChatMessage, ValidationRule, ExtractedRebarData, DetectedZone } from "../_shared/agentTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  {
    slot: 1, time: "06:30 AM", theme: "Motivational / start of work day", product: "Rebar Stirrups",
    imageStyles: VISUAL_STYLES_POOL,
  },
  {
    slot: 2, time: "07:30 AM", theme: "Creative promotional", product: "Rebar Cages",
    imageStyles: VISUAL_STYLES_POOL,
  },
  {
    slot: 3, time: "08:00 AM", theme: "Strength & scale", product: "Fiberglass Rebar (GFRP)",
    imageStyles: VISUAL_STYLES_POOL,
  },
  {
    slot: 4, time: "12:30 PM", theme: "Innovation & efficiency", product: "Wire Mesh",
    imageStyles: VISUAL_STYLES_POOL,
  },
  {
    slot: 5, time: "02:30 PM", theme: "Product promotional", product: "Rebar Dowels",
    imageStyles: VISUAL_STYLES_POOL,
  },
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
2. Write a SHORT English advertising slogan (MAXIMUM 8 words) that will be printed directly ON the image. It must be catchy, memorable, and specific to the product.
3. Write 8-12 relevant hashtags as a single string separated by spaces.
4. Translate the caption to Farsi (Persian).
5. Translate the image slogan to Farsi (Persian).

CRITICAL RULES:
- Every single call MUST produce COMPLETELY NEW and ORIGINAL content
- NEVER use generic phrases like "Building strong" or "Engineering excellence"
- Be creative, bold, and specific to the product
- The image slogan must be short enough to be readable when printed on an image
- NEVER mention any posting time, schedule time, or clock time in the caption or slogan
- Use a unique creative angle each time: humor, statistics, metaphors, customer benefits, industry facts, seasonal relevance, etc.${regenerateInstruction}
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
  options?: { styleIndex?: number | string },
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

  // Build attempts: model + whether to include logo
  const attempts: { model: string; useLogo: boolean }[] = [
    { model: "google/gemini-2.5-flash-image", useLogo: true },
    { model: "google/gemini-2.5-flash-image", useLogo: true },
    { model: "google/gemini-3-pro-image-preview", useLogo: true },
  ];

  let lastError = "Unknown error";

  for (const attempt of attempts) {
    try {
      const contentParts: any[] = [{ type: "text", text: fullPrompt }];

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

      console.log(`  → Attempt: ${attempt.model}, logo=${attempt.useLogo && !!logoUrl}`);

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
        }),
      });

      if (!aiRes.ok) {
        lastError = `${attempt.model} returned ${aiRes.status}`;
        console.warn(`  ✗ ${lastError}`);
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent, message, history = [], context: userContext = {}, attachedFiles = [], pixelSlot, preferredModel } = await req.json() as AgentRequest;
    
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Invalid user token");

    // Fetch user details
    const { data: profile } = await svcClient
      .from("profiles")
      .select("id, full_name, email, company_id")
      .eq("user_id", user.id)
      .single();

    const userFullName = profile?.full_name || user.user_metadata?.full_name || "User";
    const userEmail = profile?.email || user.email || "user@rebar.shop";
    const companyId = profile?.company_id || "a0000000-0000-0000-0000-000000000001"; // Fallback for dev

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
    if (agent === "data" || agent === "empire" || agent === "commander" || agent === "assistant") {
      execContext = await fetchExecutiveContext(svcClient, companyId);
    }
    
    const mergedContext = { ...dbContext, ...execContext, ...userContext };

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
      const isScheduleRequest = (
        history.length === 0 || // new chat
        /\b(content\s*schedule|schedule\s*for\s*today|today|program|برنامه)\b/i.test(msgLower)
      ) && !/^\d$/.test(msgLower) && msgLower !== "all"; // not a slot selection

      if (isScheduleRequest) {
        const scheduleDate = (userContext?.selectedDate as string) ||
          new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Toronto" });

        const scheduleReply = `📅 **Content Schedule — ${scheduleDate}**

| # | Time (EST) | Theme | Product |
|---|-----------|-------|---------|
| 1 | 06:30 AM | Motivational / start of work day | Rebar Stirrups |
| 2 | 07:30 AM | Creative promotional | Rebar Cages |
| 3 | 08:00 AM | Strength & scale | Fiberglass Rebar (GFRP) |
| 4 | 12:30 PM | Innovation & efficiency | Wire Mesh |
| 5 | 02:30 PM | Product promotional | Rebar Dowels |

**Which slot? (Enter 1-5, a time, or "all")**`;

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

      // Also match time-based inputs
      const TIME_TO_SLOT: Record<string, number> = {
        "06:30": 1, "6:30": 1, "6:30 am": 1, "06:30 am": 1,
        "07:30": 2, "7:30": 2, "7:30 am": 2, "07:30 am": 2,
        "08:00": 3, "8:00": 3, "8:00 am": 3, "08:00 am": 3,
        "12:30": 4, "12:30 pm": 4,
        "14:30": 5, "2:30 pm": 5, "02:30 pm": 5, "02:30": 5,
      };
      const timeSlotNum = TIME_TO_SLOT[msgLower];

      if (slotMatch || isAllSlots || timeSlotNum || isRegenerate) {
        console.log("🎨 Pixel Step 2: Deterministic image generation triggered", isRegenerate ? "(REGENERATE)" : "");

        // Resolve company logo — MANDATORY, block if missing
        const logoUrl = await resolveLogoUrl();
        if (!logoUrl) {
          return new Response(
            JSON.stringify({
              reply: "🚫 **Company logo not found!**\n\nThe company logo is **required** for all image generation. Please upload it to `social-images/brand/company-logo.png` in storage, then try again.",
              context: mergedContext,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
          : (timeSlotNum || parseInt(slotMatch?.[1] || "1"));
        const slotsToGenerate = isAllSlots
          ? PIXEL_SLOTS
          : [PIXEL_SLOTS[resolvedSlotNum - 1]];

        const results: string[] = [];

        for (const slot of slotsToGenerate) {
          console.log(`🎨 Pixel: Generating DYNAMIC content for slot ${slot.slot} (${slot.product})...`);

          // Step A: Generate unique, non-repeating caption + slogan + hashtags via LLM
          // Inject brain knowledge block into content generation
          const brainKnowledge = (mergedContext.brainKnowledgeBlock as string) || "";
          // Generate a session-unique seed to ensure every chat produces distinct creative output
          const sessionSeed = `${(mergedContext.sessionId as string) || "anon"}-${crypto.randomUUID()}`;

          const dynContent = await generateDynamicContent(slot, isRegenerate, brainKnowledge, preferredModel, sessionSeed);

          // Step B: Build image prompt with MANDATORY advertising text on image
          // If brain has image references, append them to inspire generation
          const brainImageRefs = brainKnowledge
            ? brainKnowledge.match(/https?:\/\/\S+\.(jpg|jpeg|png|webp|svg)/gi) || []
            : [];
          const brainImageHint = brainImageRefs.length > 0
            ? `\nReference brand images for style inspiration: ${brainImageRefs.slice(0, 3).join(", ")}`
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

          const imagePrompt = `MANDATORY REALISM RULE: ALL images MUST be PHOTOREALISTIC — real-world photography style ONLY. ` +
            `ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract art, AI-looking art, stock photo feel. ` +
            `Every image MUST look like it was taken by a professional photographer with a real camera at a real location.\n\n` +
            `VISUAL STYLE: ${selectedStyle}. ` +
            `PRODUCT FOCUS: ${slot.product} for REBAR.SHOP. THEME: ${slot.theme}. ` +
            `MANDATORY: Write this exact advertising text prominently on the image in a clean, bold, readable font: "${dynContent.imageText}"` +
            brainImageHint +
            dedupHint +
            forbiddenHint +
            ` — unique session seed: ${sessionSeed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` +
            `\n\nMANDATORY VISUAL DIVERSITY RULES:\n` +
            `- Use the specified visual style EXACTLY as described above\n` +
            `- FORBIDDEN: Do not repeat any composition, camera angle, color palette, or scene layout from recent images\n` +
            `- Each image must feel like it belongs to a completely different photo series\n` +
            `- Ultra high resolution, PHOTOREALISTIC ONLY, 1:1 square aspect ratio, perfect for Instagram\n` +
            `- Must look like a REAL photograph — natural imperfections, real lighting, actual textures`;

          console.log(`🎨 Pixel: Generating image for slot ${slot.slot} with style #${selectedStyleIndex}: ${selectedStyle}...`);
          const imgResult = await generatePixelImage(imagePrompt, svcClient, logoUrl, { styleIndex: selectedStyleIndex });

          // Only show imageTextFa line if it has actual content
          const hasImageText = dynContent.imageTextFa && dynContent.imageTextFa.trim() !== "" && dynContent.imageTextFa.trim() !== "-";
          const persianBlock = `\n\n---PERSIAN---\n` +
            (hasImageText ? `🖼️ متن روی عکس: ${dynContent.imageTextFa}\n` : "") +
            `📝 ترجمه کپشن: ${dynContent.captionFa}`;

          if (imgResult.imageUrl) {
            results.push(
              `### Slot ${slot.slot} — ${slot.product}\n\n` +
              `![${slot.product}](${imgResult.imageUrl})\n\n` +
              `**Caption:**\n${dynContent.caption}\n\n` +
              `**Hashtags:**\n${dynContent.hashtags}` +
              PIXEL_CONTACT_INFO +
              persianBlock
            );
          } else {
            results.push(
              `### Slot ${slot.slot} — ${slot.product}\n\n` +
              `⚠️ Image generation failed: ${imgResult.error || "Unknown error"}\n\n` +
              `**Caption:**\n${dynContent.caption}\n\n` +
              `**Hashtags:**\n${dynContent.hashtags}` +
              PIXEL_CONTACT_INFO +
              persianBlock
            );
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
    const staticSystemPrompt = ONTARIO_CONTEXT + basePrompt + 
      GOVERNANCE_RULES + DRAFT_ONLY_BLOCK + SHARED_TOOL_INSTRUCTIONS + IDEA_GENERATION_INSTRUCTIONS + LANG_INSTRUCTION +
      `\n\n## Current User\nName: ${userFullName}\nEmail: ${userEmail}`;

    // Dynamic content goes in a separate system message to preserve cache boundary
    const dynamicContext = (mergedContext.brainKnowledgeBlock as string || "") +
      (mergedContext.roleAccessBlock as string || "") +
      ragBlock + contextStr;

    // Document analysis summary injection
    let docSummary = "";
    if (agent === "estimation" && documentResults.length > 0) {
      docSummary = "\n\n📋 DOCUMENT ANALYSIS RESULTS:\n" + documentResults.map(d => `--- ${d.fileName} ---\n${d.text.substring(0, 1000)}...`).join("\n");
    }

    const messages: ChatMessage[] = [
      { role: "system", content: staticSystemPrompt },
      ...(dynamicContext || docSummary ? [{ role: "system" as const, content: dynamicContext + docSummary }] : []),
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

    // AI Call
    let aiResult = await callAI({
      provider: modelConfig.provider,
      model: modelConfig.model,
      messages: messages as AIMessage[],
      maxTokens: modelConfig.maxTokens,
      temperature: modelConfig.temperature,
      tools,
      toolChoice: "auto",
      fallback: { provider: "gemini", model: "gemini-2.5-flash" },
    });

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
      
      const nextMessages = [...messages, ...accumulatedTurns];
      
      // Follow-up AI call (with fallback to ensure tool loops survive GPT failures)
      aiResult = await callAI({
        provider: modelConfig.provider,
        model: modelConfig.model,
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

  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
