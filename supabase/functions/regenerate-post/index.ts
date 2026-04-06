import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cropToAspectRatio } from "../_shared/imageResize.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

// ─── Same visual styles pool as Pixel agent ───
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

const PIXEL_CONTACT_INFO = `\n\n📍 9 Cedar Ave, Thornhill, Ontario\n📞 647-260-9403\n🌐 www.rebar.shop`;

// ─── Helpers (same as Pixel agent) ───

function extractImageFromAIResponse(aiData: any): string | null {
  const msg = aiData?.choices?.[0]?.message;
  if (!msg) return null;
  const img = msg.images?.[0]?.image_url?.url;
  if (img) return img;
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (part.inline_data?.data) {
        const mime = part.inline_data.mime_type || "image/png";
        return `data:${mime};base64,${part.inline_data.data}`;
      }
    }
  }
  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "image_url" && block.image_url?.url) return block.image_url.url;
    }
  }
  return null;
}

async function resolveLogoUrl(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl) return null;
  const logoUrl = `${supabaseUrl}/storage/v1/object/public/social-images/brand/company-logo.png`;
  try {
    const check = await fetch(logoUrl, { method: "HEAD" });
    if (!check.ok) { console.warn(`⚠️ Logo not found (HTTP ${check.status})`); return null; }
  } catch { return null; }
  return logoUrl;
}

async function generatePixelImage(
  prompt: string,
  svcClient: ReturnType<typeof createClient>,
  logoUrl: string | null,
  options?: { styleIndex?: number | string; previousImageUrl?: string; preferredModel?: string; resourceImageUrls?: string[]; imageAspectRatio?: string },
): Promise<{ imageUrl: string | null; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return { imageUrl: null, error: "LOVABLE_API_KEY not configured" };

  const fullPrompt = logoUrl
    ? prompt +
      "\n\nMANDATORY: The attached company logo image MUST be placed EXACTLY as-is in the generated image, " +
      "without ANY modification, distortion, or recreation. Place it in a visible corner as a watermark. " +
      "Do NOT create or draw any other logo — ONLY use the provided logo image. " +
      "Do NOT add text-based watermarks."
    : prompt;

  // Inject aspect ratio instruction at the START of prompt for maximum priority
  const aspectRatio = options?.imageAspectRatio || "1:1";
  const dimensionMap: Record<string, string> = { "16:9": "1536×1024", "9:16": "1024×1536", "1:1": "1024×1024" };
  const orientationMap: Record<string, string> = { "16:9": "LANDSCAPE (wider than tall)", "9:16": "PORTRAIT/VERTICAL (taller than wide)", "1:1": "SQUARE (equal width and height)" };
  const aspectInstruction = `MANDATORY IMAGE DIMENSIONS: Generate in ${orientationMap[aspectRatio] || orientationMap["1:1"]} format (${dimensionMap[aspectRatio] || dimensionMap["1:1"]} pixels, ${aspectRatio} ratio). The output MUST strictly follow this aspect ratio.`;
  const finalPrompt = aspectInstruction + "\n\n" + fullPrompt;

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
      console.log("  → Falling back to Gemini image generation...");
    } else {
      console.warn("  ⚠️ GPT_API_KEY not configured, falling back to Gemini for image generation");
    }
  }

  const hasRefs = !!options?.resourceImageUrls?.length;
  const attempts: { model: string; useLogo: boolean; useRefs: boolean }[] = [
    { model: "google/gemini-2.5-flash-image", useLogo: true, useRefs: true },
    { model: "google/gemini-2.5-flash-image", useLogo: true, useRefs: true },
    { model: "google/gemini-3-pro-image-preview", useLogo: true, useRefs: true },
    ...(hasRefs ? [
      { model: "google/gemini-2.5-flash-image", useLogo: true, useRefs: false },
      { model: "google/gemini-3-pro-image-preview", useLogo: true, useRefs: false },
    ] : []),
    { model: "google/gemini-2.5-flash-image", useLogo: false, useRefs: false },
  ];

  let lastError = "Unknown error";

  for (const attempt of attempts) {
    try {
      const contentParts: any[] = [{ type: "text", text: finalPrompt }];

      // Attach resource/reference images from brain (only if attempt allows)
      if (attempt.useRefs && options?.resourceImageUrls?.length) {
        for (const refUrl of options.resourceImageUrls.slice(0, 3)) {
          contentParts.push({ type: "image_url", image_url: { url: refUrl } });
        }
        contentParts.push({
          type: "text",
          text: "The images above are REFERENCE product/brand images. Use them as visual inspiration for style, colors, and product appearance. Do NOT copy them exactly — create something NEW inspired by them.",
        });
      }

      // Pass previous image as negative reference to prevent duplicates
      if (options?.previousImageUrl) {
        contentParts.push({ type: "image_url", image_url: { url: options.previousImageUrl } });
        contentParts.push({
          type: "text",
          text: "⚠️ CRITICAL DEDUP RULE: The image above is the PREVIOUS version. You MUST generate something COMPLETELY DIFFERENT. " +
            "Use a DIFFERENT composition, camera angle, color palette, subject arrangement, lighting, and mood. " +
            "The new image must NOT resemble the previous one in any way. Treat it as a forbidden reference.",
        });
      }

      if (attempt.useLogo && logoUrl) {
        contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
        contentParts.push({
          type: "text",
          text: "CRITICAL: The logo image provided above is the ONLY authorized company logo. " +
            "Place it EXACTLY as-is (no redrawing, no text replacement, no modification) in a visible corner of the generated image. " +
            "Do NOT create any other logo or text-based watermark.",
        });
      }

      console.log(`  → Attempt: ${attempt.model}, logo=${attempt.useLogo && !!logoUrl}, refs=${attempt.useRefs}`);
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
        }),
      });

      if (!aiRes.ok) { const errSnippet = await aiRes.text().catch(() => ""); lastError = `${attempt.model} returned ${aiRes.status}`; console.warn(`  ✗ ${lastError}: ${errSnippet.slice(0, 200)}`); continue; }

      const aiData = await aiRes.json();
      const imageDataUrl = extractImageFromAIResponse(aiData);
      if (!imageDataUrl) { lastError = `${attempt.model} returned no image`; console.warn(`  ✗ ${lastError}`); continue; }

      let imageBytes: Uint8Array;
      if (imageDataUrl.startsWith("data:")) {
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
        imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      } else {
        const imgResp = await fetch(imageDataUrl);
        if (!imgResp.ok) { lastError = "Failed to download generated image"; continue; }
        imageBytes = new Uint8Array(await imgResp.arrayBuffer());
      }

      // Enforce aspect ratio via server-side crop/resize
      imageBytes = await cropToAspectRatio(imageBytes, aspectRatio);

      const styleTag = options?.styleIndex ?? "x";
      const imagePath = `pixel/${Date.now()}-s${styleTag}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error: uploadError } = await svcClient.storage
        .from("social-images")
        .upload(imagePath, imageBytes, { contentType: "image/png", upsert: false });

      if (uploadError) { lastError = `Upload failed: ${uploadError.message}`; console.warn(`  ✗ ${lastError}`); continue; }

      const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
      console.log(`  ✓ Image uploaded: ${urlData.publicUrl}`);
      return { imageUrl: urlData.publicUrl };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`  ✗ Attempt error: ${lastError}`);
    }
  }

  return { imageUrl: null, error: `All attempts failed. Last: ${lastError}` };
}

// ─── Main handler ───

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabase, body } = ctx;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { post_id, caption_only, is_video, selectedProducts, imageStyles } = body;
    if (!post_id) throw new Error("post_id is required");

    // 1. Fetch post
    const { data: post, error: fetchErr } = await supabase
      .from("social_posts")
      .select("*")
      .eq("id", post_id)
      .single();
    if (fetchErr || !post) throw new Error("Post not found");

    // 1b. Fetch brain context (custom instructions + knowledge)
    let brainKnowledge = "";
    try {
      const { data: brainItems } = await supabase
        .from("knowledge")
        .select("title, content, category, metadata")
        .eq("company_id", post.company_id)
        .order("created_at", { ascending: false });

      if (brainItems) {
        const socialItems = brainItems.filter(
          (item: any) => (item.metadata as any)?.agent === "social"
        );
        const instructions = socialItems.find(
          (item: any) => (item.metadata as any)?.type === "instructions"
        );
        const files = socialItems.filter(
          (item: any) => (item.metadata as any)?.type !== "instructions"
        );

        if (instructions?.content) {
          brainKnowledge += `\n## Custom Instructions:\n${instructions.content}\n`;
        }
        for (const f of files.slice(0, 10)) {
          brainKnowledge += `\n## ${f.title} (${f.category}):\n${f.content || "(file)"}\n`;
        }
      }
    } catch (e) {
      console.warn("Could not fetch brain context:", e);
    }

    const sessionSeed = `regen-${crypto.randomUUID()}`;
    const brainBlock = brainKnowledge.trim()
      ? `\n\n## MANDATORY BRAIN CONTEXT (YOU MUST USE THIS):\n${brainKnowledge}\n\nCRITICAL: You MUST incorporate the above brain context into your generated content.\n`
      : "";

    const isVideoPost = is_video || (post.image_url && /\.(mp4|mov|webm)(\?|$)/i.test(post.image_url));

    // ─── CAPTION-ONLY mode: just regenerate caption based on the image ───
    if (caption_only) {
      const videoInstruction = isVideoPost
        ? `This post contains a VIDEO (not an image). Write a GENERAL promotional caption about REBAR.SHOP as a company — our services, reliability, fast delivery, customer satisfaction, construction industry leadership in Ontario. Do NOT focus on any specific product. Write about the company brand, values, and broad services.`
        : `You are looking at an image from a social media post. Based on what you see in the image, write a NEW short promotional caption.`;

      const captionOnlyPrompt = `You are an elite creative advertising copywriter for REBAR.SHOP, a premium rebar and steel reinforcement company in Ontario, Canada.

${videoInstruction}

Platform: ${post.platform}
${brainBlock}

RULES:
- Write a short, punchy, promotional English caption. Maximum 2 sentences.
- Write 8-12 relevant hashtags as a single string separated by spaces.
- Write a short catchy title (max 10 words).
- Translate the caption to Farsi (Persian). This MUST be a beautiful, fluent, native-quality Persian translation — NOT a word-by-word translation. Rewrite the meaning in elegant, professional Persian that sounds like it was originally written by a native Persian advertising copywriter.
- CAPTION TONE: PURELY PROMOTIONAL & ADVERTISING — catchy, bold, emotional. Do NOT explain how the product works. Focus on why the customer should buy.
- ABSOLUTELY FORBIDDEN: scientific explanations, technical specs, engineering terminology, material properties, structural analysis claims.
- FORBIDDEN WORDS: guarantee, guaranteed, ensures, ensure, promise, warranty, certified, certify, unparalleled, revolutionary, superior, structural integrity, load-bearing, tensile strength, AI-driven, precision-engineered, interlocks, unmatched, finest, unbeatable, top-notch, scientifically, assured
- Do NOT mention ANY time of day, hour, clock time, AM/PM
- Be bold, specific, and direct. Use relevant emojis.
- SESSION SEED: ${sessionSeed}

Respond with ONLY a valid JSON object (no markdown, no code fences):
{"title": "...", "caption": "...", "hashtags": "...", "captionFa": "..."}`;

      const contentParts: any[] = [{ type: "text", text: captionOnlyPrompt }];
      // Only attach image if it's NOT a video (AI models can't process MP4/MOV/WebM)
      if (post.image_url && !isVideoPost) {
        contentParts.push({ type: "image_url", image_url: { url: post.image_url } });
      }

      // Model rotation for caption-only (prevents single-model 503 failures)
      const captionOnlyModels = ["google/gemini-2.5-flash", "google/gemini-3-flash-preview", "openai/gpt-5-mini"];
      let capRes: Response | null = null;
      for (const model of captionOnlyModels) {
        console.log(`[regenerate-post] Caption-only trying model: ${model}`);
        capRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: contentParts }],
            ...(model.startsWith("google/") ? {} : { temperature: 1.0 }),
          }),
        });
        if (capRes.ok) break;
        const errBody = await capRes.text();
        console.error(`[regenerate-post] Caption model ${model} failed (${capRes.status}): ${errBody}`);
        capRes = null;
        // Small delay before next model
        await new Promise(r => setTimeout(r, 500));
      }

      if (!capRes) throw new Error("Caption generation failed — all models returned errors");

      const capData = await capRes.json();
      const rawCap = capData.choices?.[0]?.message?.content || "";
      const jsonCap = rawCap.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const newCap = JSON.parse(jsonCap);

      if (!newCap.caption) throw new Error("Missing caption in response");

      const persianBlock = newCap.captionFa
        ? `\n\n---PERSIAN---\n📝 ترجمه کپشن: ${newCap.captionFa}`
        : "";
      const fullContent = `${newCap.caption}${PIXEL_CONTACT_INFO}\n\n${newCap.hashtags || ""}${persianBlock}`;
      const hashtags = (newCap.hashtags || "").split(/\s+/).filter((h: string) => h.startsWith("#"));

      const { error: updateErr } = await supabase
        .from("social_posts")
        .update({
          title: newCap.title || post.title,
          content: fullContent,
          hashtags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post_id);

      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

      return new Response(
        JSON.stringify({ success: true, title: newCap.title || post.title, content: fullContent, hashtags }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Generate new caption + image text via LLM (full regeneration)
    const captionPrompt = `You are an elite creative advertising copywriter for RebarShop, a premium rebar and steel reinforcement company based in Ontario, Canada.

Current post title: ${post.title}
Current post content: ${post.content}
Platform: ${post.platform}
${brainBlock}
${isVideoPost ? `IMPORTANT: This post contains a VIDEO. Write a GENERAL promotional caption about REBAR.SHOP as a company — services, reliability, delivery, customer satisfaction, construction leadership in Ontario. Do NOT focus on any specific product.\n` : ""}YOUR TASK — Generate COMPLETELY NEW and DIFFERENT advertising content. Follow these rules STRICTLY:

1. Write a compelling, UNIQUE English caption (2-4 sentences) ${isVideoPost ? "about REBAR.SHOP company and services broadly" : "for this product/topic"}. Use relevant emojis.
🚨 ZERO OVERLAP RULE: The caption and the image slogan MUST have ZERO overlapping words or phrases. The slogan sells EMOTION (max 6 words). The caption sells SERVICES (delivery, products, benefits). NEVER repeat, rephrase, or echo the slogan in the caption. VIOLATION = rejection.
2. Write a SHORT English advertising slogan (MAXIMUM 6 words) that will be printed ON the image. It MUST be: simple, catchy, beautiful, and grammatically perfect English. Pure advertising tagline — NO guarantees, NO technical terms, NO scientific claims. Think billboard: short, emotional, memorable. GOOD: "Steel That Builds Dreams", "Your Project, Our Pride". BAD: "Unparalleled Structural Integrity", "Guaranteed Quality Framework".
3. Write 8-12 relevant hashtags as a single string separated by spaces.
4. Translate the caption to Farsi (Persian) — this MUST be a premium-quality, natural-sounding Persian translation. Do NOT translate word-by-word. Instead, rewrite the meaning in beautiful, fluent Persian that sounds like it was originally written by a native Persian copywriter. Use elegant vocabulary, proper Persian grammar, and a professional advertising tone.
5. Translate the image slogan to Farsi (Persian) — same quality standard: fluent, catchy, natural Persian. Not a literal translation.
6. Write a short catchy title (max 10 words).

CRITICAL RULES:
- CAPTION TONE: PURELY PROMOTIONAL & ADVERTISING — catchy, bold, emotional appeal. Do NOT explain how the product works. Focus on WHY the customer should buy.
- ABSOLUTELY FORBIDDEN CONTENT: scientific explanations, technical specifications, engineering terminology, material properties, structural analysis claims.
- Content MUST be COMPLETELY DIFFERENT from the current post
- NEVER use generic phrases like "Building strong" or "Engineering excellence"
- ABSOLUTELY FORBIDDEN: Do NOT mention ANY time of day, hour, clock time, AM/PM
- FORBIDDEN WORDS: guarantee, guaranteed, ensures, ensure, promise, warranty, certified, certify, unparalleled, revolutionary, superior, structural integrity, load-bearing, tensile strength, AI-driven, precision-engineered, interlocks, unmatched, finest, unbeatable, top-notch, scientifically, assured
- Be creative, bold, and specific
- IMAGE SLOGAN RULES: Must be a simple, beautiful advertising phrase. Maximum 6 words. No technical jargon. No guarantees. No scientific claims. Must be grammatically perfect English. Think billboard advertising.
- SESSION CREATIVE SEED: ${sessionSeed} — use this to drive a UNIQUE creative direction
${brainKnowledge ? "- You MUST follow any brand guidelines from the Brain Context above" : ""}

Respond with ONLY a valid JSON object (no markdown, no code fences):
{"title": "...", "caption": "...", "hashtags": "...", "imageText": "...", "imageTextFa": "...", "captionFa": "..."}`;

    const captionModels = ["google/gemini-2.5-flash", "openai/gpt-5-mini"];
    let captionRes: Response | null = null;
    for (const model of captionModels) {
      console.log(`[regenerate-post] Trying caption model: ${model}`);
      captionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: captionPrompt }],
          ...(model.startsWith("google/") ? {} : { temperature: 1.0 }),
        }),
      });
      if (captionRes.ok) break;
      const errBody = await captionRes.text();
      console.error(`[regenerate-post] Model ${model} failed (${captionRes.status}): ${errBody}`);
      captionRes = null;
    }

    if (!captionRes) throw new Error("Caption generation failed — all models returned errors");

    const captionData = await captionRes.json();
    const rawContent = captionData.choices?.[0]?.message?.content || "";
    const jsonStr = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const newContent = JSON.parse(jsonStr);

    if (!newContent.caption || !newContent.imageText) throw new Error("Missing required fields in caption response");
    console.log("Generated content:", JSON.stringify({ title: newContent.title, imageText: newContent.imageText }));

    // Post-processing: enforce slogan/caption separation
    const sloganLower = (newContent.imageText || "").toLowerCase().trim();
    const captionLower = (newContent.caption || "").toLowerCase();
    if (sloganLower && captionLower) {
      const sloganWords = sloganLower.split(/\s+/).filter((w: string) => w.length > 3);
      const captionWords = captionLower.split(/\s+/);
      const overlap = sloganWords.filter((w: string) => captionWords.includes(w));
      const overlapRatio = sloganWords.length > 0 ? overlap.length / sloganWords.length : 0;
      if (overlapRatio > 0.4) {
        console.warn(`⚠️ [regenerate] Slogan/caption overlap: ${Math.round(overlapRatio * 100)}% — "${newContent.imageText}" vs caption. Requesting rewrite...`);
        // Quick rewrite: ask AI for a new caption that avoids the slogan
        try {
          const rewriteRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: `The image slogan is: "${newContent.imageText}". Write a COMPLETELY DIFFERENT promotional caption (2-3 sentences) for REBAR.SHOP rebar company in Ontario. The caption MUST describe services, delivery speed, product range, or customer benefits. It MUST NOT use ANY words from the slogan. Include 📍 9 Cedar Ave, Thornhill, Ontario 📞 647-260-9403 🌐 www.rebar.shop. Respond with ONLY the caption text, nothing else.` }],
            }),
          });
          if (rewriteRes.ok) {
            const rewriteData = await rewriteRes.json();
            const rewrittenCaption = rewriteData.choices?.[0]?.message?.content?.trim();
            if (rewrittenCaption && rewrittenCaption.length > 30) {
              console.log(`✅ Caption rewritten to avoid slogan overlap.`);
              newContent.caption = rewrittenCaption;
            }
          }
        } catch (e) {
          console.warn("Caption rewrite failed (non-critical):", e);
        }
      }
    }

    // 3. Generate image using exact Pixel pipeline
    const logoUrl = await resolveLogoUrl();

    // Fetch recent images for dedup
    let recentImageNames: string[] = [];
    try {
      const { data: recentFiles } = await supabase.storage
        .from("social-images")
        .list("pixel", { limit: 30, sortBy: { column: "created_at", order: "desc" } });
      if (recentFiles) recentImageNames = recentFiles.map((f: any) => f.name);
    } catch (e) { console.warn("Could not fetch recent images for dedup:", e); }

    // Style & product maps for user overrides
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
      stirrups: "Rebar Stirrups — bent steel reinforcement loops used to hold vertical rebar in columns and beams",
      cages: "Rebar Cages — pre-assembled cylindrical or rectangular steel reinforcement cages for foundations and piles",
      hooks: "Rebar Hooks — bent steel bars with hooked ends for anchoring in concrete structures",
      dowels: "Rebar Dowels — straight steel bars used to connect concrete slabs and structural joints",
      wire_mesh: "Wire Mesh — welded steel wire mesh sheets for slab reinforcement and concrete crack control",
      straight: "Rebar Straight — standard straight steel reinforcement bars in various sizes",
    };

    // User overrides from request
    const userEffectiveStyle = imageStyles?.length
      ? imageStyles.map((k: string) => IMAGE_STYLE_MAP[k] || k).join(". ")
      : null;
    const userProductFocus = selectedProducts?.length
      ? selectedProducts.map((k: string) => PRODUCT_PROMPT_MAP[k] || k).join("; ")
      : null;
    const productFocusBlock = userProductFocus
      ? `\n\n## USER-SELECTED PRODUCTS (image MUST prominently feature these products):\n${userProductFocus}\nThe image must clearly show these specific products in a realistic industrial/construction setting.\n\n`
      : "";

    // Style selection with dedup (user override takes priority)
    const usedStyleIndices = new Set<number>();
    for (const name of recentImageNames) {
      const match = name.match(/-s(\d+)-/);
      if (match) usedStyleIndices.add(parseInt(match[1]));
    }
    const availableStyles = VISUAL_STYLES_POOL
      .map((s, idx) => ({ style: s, idx }))
      .filter(({ idx }) => !usedStyleIndices.has(idx));
    const stylePool = availableStyles.length > 0 ? availableStyles : VISUAL_STYLES_POOL.map((s, idx) => ({ style: s, idx }));
    const selected = stylePool[Math.floor(Math.random() * stylePool.length)];
    const effectiveStyle = userEffectiveStyle || selected.style;

    const dedupHint = recentImageNames.length > 0
      ? `\n\nPREVIOUSLY GENERATED (MUST NOT resemble any of these): ${recentImageNames.slice(0, 15).join(", ")}`
      : "";

    const forbiddenStyles = [...usedStyleIndices]
      .map(i => VISUAL_STYLES_POOL[i])
      .filter(Boolean)
      .slice(0, 5);
    const forbiddenHint = forbiddenStyles.length > 0
      ? `\nFORBIDDEN STYLES (already used recently, DO NOT use): ${forbiddenStyles.join("; ")}`
      : "";

    // Resolve fresh signed URLs for brain image resources
    let brainImageRefs: string[] = [];
    try {
      const { data: imgKnowledge } = await supabase
        .from("knowledge")
        .select("source_url, metadata")
        .eq("company_id", post.company_id)
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
          if (storagePath) {
            const { data: signedData } = await supabase.storage
              .from(storageBucket)
              .createSignedUrl(storagePath, 3600);
            if (signedData?.signedUrl) { brainImageRefs.push(signedData.signedUrl); continue; }
          }
          const signMatch = item.source_url.match(/\/object\/sign\/([^/]+)\/([^?]+)/);
          if (signMatch) {
            const bucket = signMatch[1];
            const path = decodeURIComponent(signMatch[2]);
            const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
            if (signedData?.signedUrl) { brainImageRefs.push(signedData.signedUrl); continue; }
          }
          if (item.source_url.includes("/object/public/")) {
            try { const h = await fetch(item.source_url, { method: "HEAD" }); if (h.ok) brainImageRefs.push(item.source_url); } catch {}
          }
        }
      }
    } catch (e) { console.warn("Could not resolve brain image refs:", e); }
    brainImageRefs = brainImageRefs.filter(u => !/\.svg(\?|$)/i.test(u));
    console.log(`Brain image refs resolved: ${brainImageRefs.length} valid URLs`);
    const brainImageHint = brainImageRefs.length > 0
      ? `\nReference brand images for style inspiration: (${brainImageRefs.length} images attached)`
      : "";

    // Extract custom instructions from brain knowledge for image prompt
    const customInstructionsMatch = brainKnowledge.match(/## Custom Instructions:\n([\s\S]*?)(?=\n## |\n\n## |$)/);
    const customInstructions = customInstructionsMatch?.[1]?.trim() || "";
    const customInstructionsBlock = customInstructions
      ? `\n\n## USER IMAGE INSTRUCTIONS (MUST FOLLOW STRICTLY):\n${customInstructions}\n\n`
      : "";

    // Build image prompt — user-selected product/style at HIGHEST PRIORITY at the top
    const userPriorityBlock = (userProductFocus || userEffectiveStyle)
      ? `## ⚠️ HIGHEST PRIORITY — USER EXPLICITLY REQUESTED:\n` +
        (userProductFocus ? `PRODUCT: ${userProductFocus}\n` : "") +
        (userEffectiveStyle ? `STYLE: ${userEffectiveStyle}\n` : "") +
        `The image MUST show exactly these products in this style. This overrides ALL other defaults below.\n\n`
      : "";

    const NON_REALISTIC_STYLES_R = ["cartoon", "animation", "painting", "ai_modern"];
    const userWantsNonRealistic = imageStyles?.some((s: string) => NON_REALISTIC_STYLES_R.includes(s));

    const realismRule = userWantsNonRealistic
      ? `STYLE OVERRIDE: The user explicitly selected a non-photorealistic style. You MUST follow "${effectiveStyle}" EXACTLY. Do NOT make it photorealistic. Do NOT add real-camera or photograph qualities.\n\n`
      : `MANDATORY REALISM RULE: ALL images MUST be PHOTOREALISTIC — real-world photography style ONLY. ` +
        `ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract art, AI-looking art, stock photo feel. ` +
        `Every image MUST look like it was taken by a professional photographer with a real camera at a real location.\n\n`;

    const qualitySuffix = userWantsNonRealistic
      ? `- Ultra high resolution, 1:1 square aspect ratio, perfect for Instagram\n` +
        `- Follow the "${effectiveStyle}" style with professional quality`
      : `- Ultra high resolution, PHOTOREALISTIC ONLY, 1:1 square aspect ratio, perfect for Instagram\n` +
        `- Must look like a REAL photograph — natural imperfections, real lighting, actual textures`;

    const imagePrompt = userPriorityBlock + customInstructionsBlock + productFocusBlock +
      realismRule +
      `ABSOLUTELY NO DUPLICATES — every image must be unique in composition, angle, color palette, and scene.\n\n` +
      `VISUAL STYLE: ${effectiveStyle}. ` +
      `PRODUCT/TOPIC FOCUS: ${userProductFocus || newContent.title || post.title} for REBAR.SHOP. THEME: ${newContent.caption?.slice(0, 100)}. ` +
      `MANDATORY: Write this exact advertising text prominently on the image in a clean, bold, readable font: "${newContent.imageText}"` +
      brainImageHint +
      dedupHint +
      forbiddenHint +
      ` — unique session seed: ${sessionSeed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` +
      `\n\nMANDATORY VISUAL DIVERSITY RULES:\n` +
      `- Use the specified visual style EXACTLY as described above\n` +
      `- FORBIDDEN: Do not repeat any composition, camera angle, color palette, or scene layout from recent images\n` +
      `- Each image must feel like it belongs to a completely different photo series\n` +
      qualitySuffix;

    console.log(`🎨 Regenerate: Using style #${selected.idx}: ${selected.style.slice(0, 60)}...`);
    const imgResult = await generatePixelImage(imagePrompt, supabase, logoUrl, { styleIndex: selected.idx, previousImageUrl: post.image_url || undefined, resourceImageUrls: brainImageRefs.slice(0, 3) });

    const imageUrl = imgResult.imageUrl || post.image_url;

    // 4. Build full content with Persian block and contact info
    const hasImageText = newContent.imageTextFa && newContent.imageTextFa.trim() !== "" && newContent.imageTextFa.trim() !== "-";
    const persianBlock = `\n\n---PERSIAN---\n` +
      (hasImageText ? `🖼️ متن روی عکس: ${newContent.imageTextFa}\n` : "") +
      `📝 ترجمه کپشن: ${newContent.captionFa || ""}`;

    const fullContent = `${newContent.caption}${PIXEL_CONTACT_INFO}\n\n${newContent.hashtags || ""}${persianBlock}`;

    // 5. Update post in DB
    const hashtags = (newContent.hashtags || "")
      .split(/\s+/)
      .filter((h: string) => h.startsWith("#"));

    const { error: updateErr } = await supabase
      .from("social_posts")
      .update({
        title: newContent.title || post.title,
        content: fullContent,
        hashtags: hashtags,
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post_id);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        title: newContent.title || post.title,
        content: fullContent,
        hashtags: hashtags,
        image_url: imageUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, {
    functionName: "regenerate-post",
    authMode: "required",
    requireCompany: false,
    wrapResult: false,
    requireAnyRole: ["admin", "marketing"],
  })
);
