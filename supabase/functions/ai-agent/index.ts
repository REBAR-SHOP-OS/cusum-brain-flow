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
const PIXEL_SLOTS = [
  {
    slot: 1, time: "06:30 AM", theme: "Motivational / start of work day", product: "Rebar Stirrups",
    imageStyle: "Professional construction site at sunrise golden hour, perfectly arranged steel rebar stirrups in the foreground, workers arriving at a large concrete building project, motivational atmosphere, ultra high resolution, photorealistic, 1:1 square aspect ratio, perfect for Instagram",
  },
  {
    slot: 2, time: "07:30 AM", theme: "Creative promotional", product: "Rebar Cages",
    imageStyle: "Dramatic close-up of a perfectly assembled steel rebar cage being lifted by a crane at a construction site, creative advertising angle, professional photography, golden light, ultra high resolution, photorealistic, 1:1 square aspect ratio, perfect for Instagram",
  },
  {
    slot: 3, time: "08:00 AM", theme: "Strength & scale", product: "Fiberglass Rebar (GFRP)",
    imageStyle: "Modern infrastructure project showcasing fiberglass GFRP rebar installation, vibrant green fiberglass bars contrasting with grey concrete, professional construction photography, strength and innovation theme, ultra high resolution, photorealistic, 1:1 square aspect ratio, perfect for Instagram",
  },
  {
    slot: 4, time: "12:30 PM", theme: "Innovation & efficiency", product: "Wire Mesh",
    imageStyle: "Overhead view of welded wire mesh sheets being laid on a large concrete slab pour, workers in safety gear, modern construction site, clean and organized, innovation and efficiency theme, ultra high resolution, photorealistic, 1:1 square aspect ratio, perfect for Instagram",
  },
  {
    slot: 5, time: "02:30 PM", theme: "Product promotional", product: "Rebar Dowels",
    imageStyle: "Professional product photography of precision-cut steel rebar dowels arranged neatly, some installed in a concrete joint, afternoon lighting, clean industrial setting, promotional advertising style, ultra high resolution, photorealistic, 1:1 square aspect ratio, perfect for Instagram",
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
Time slot: ${slot.time}
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
- Use a unique creative angle each time: humor, statistics, metaphors, customer benefits, industry facts, seasonal relevance, etc.${regenerateInstruction}
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
async function resolveLogoUrl(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl) throw new Error("SUPABASE_URL not configured");
  const logoUrl = `${supabaseUrl}/storage/v1/object/public/social-images/brand/company-logo.png`;

  // Preflight: verify the logo file actually exists before sending to the model
  try {
    const check = await fetch(logoUrl, { method: "HEAD" });
    if (!check.ok) {
      throw new Error(
        `لوگوی رسمی شرکت در مخزن برند پیدا نشد (HTTP ${check.status})؛ لطفاً همگام‌سازی لوگو انجام شود.`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("لوگوی رسمی")) throw err;
    throw new Error("لوگوی رسمی شرکت در مخزن برند پیدا نشد؛ لطفاً همگام‌سازی لوگو انجام شود.");
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
): Promise<{ imageUrl: string | null; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { imageUrl: null, error: "LOVABLE_API_KEY not configured" };
  }

  const fullPrompt = prompt +
    "\n\nMANDATORY: The attached company logo image MUST be placed EXACTLY as-is in the generated image, " +
    "without ANY modification, distortion, or recreation. Place it in a visible corner as a watermark. " +
    "Do NOT create or draw any other logo — ONLY use the provided logo image. " +
    "Do NOT add text-based watermarks.";

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

      const imagePath = `pixel/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
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
      .eq("user_id", user.id)
      .eq("company_id", companyId);
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
    if (agent === "data" || agent === "empire" || agent === "commander") {
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

        // Resolve company logo — abort early if missing
        let logoUrl: string;
        try {
          logoUrl = await resolveLogoUrl();
        } catch (logoErr) {
          const errMsg = logoErr instanceof Error ? logoErr.message : "لوگوی رسمی شرکت در مخزن برند پیدا نشد.";
          return new Response(JSON.stringify({ reply: `❌ ${errMsg}` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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
          const dynContent = await generateDynamicContent(slot, isRegenerate, brainKnowledge, preferredModel);

          // Step B: Build image prompt with MANDATORY advertising text on image
          // If brain has image references, append them to inspire generation
          const brainImageRefs = brainKnowledge
            ? brainKnowledge.match(/https?:\/\/\S+\.(jpg|jpeg|png|webp|svg)/gi) || []
            : [];
          const brainImageHint = brainImageRefs.length > 0
            ? `\nReference brand images for style inspiration: ${brainImageRefs.slice(0, 3).join(", ")}`
            : "";

          const imagePrompt = slot.imageStyle +
            `. MANDATORY: Write this exact advertising text prominently on the image in a clean, bold, readable font: "${dynContent.imageText}"` +
            brainImageHint +
            ` — variation timestamp: ${Date.now()}`;

          console.log(`🎨 Pixel: Generating image for slot ${slot.slot}...`);
          const imgResult = await generatePixelImage(imagePrompt, svcClient, logoUrl);

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
          content: JSON.stringify(result.result)
        });
      }

      accumulatedTurns.push(choice.message);
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

    // Fallback for empty reply
    if (!reply && !createdNotifications.length) {
      reply = "[STOP] I processed the data but couldn't generate a text response. Please check the notifications/tasks created.";
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
