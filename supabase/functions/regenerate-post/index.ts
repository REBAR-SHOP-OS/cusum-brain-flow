import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  options?: { styleIndex?: number | string },
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

  const attempts: { model: string; useLogo: boolean }[] = [
    { model: "google/gemini-2.5-flash-image", useLogo: true },
    { model: "google/gemini-2.5-flash-image", useLogo: true },
    { model: "google/gemini-3-pro-image-preview", useLogo: true },
  ];

  let lastError = "Unknown error";

  for (const attempt of attempts) {
    try {
      const contentParts: any[] = [{ type: "text", text: fullPrompt }];
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
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
        }),
      });

      if (!aiRes.ok) { lastError = `${attempt.model} returned ${aiRes.status}`; console.warn(`  ✗ ${lastError}`); continue; }

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { post_id } = await req.json();
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

    // 2. Generate new caption + image text via LLM
    const captionPrompt = `You are an elite creative advertising copywriter for RebarShop, a premium rebar and steel reinforcement company based in Ontario, Canada.

Current post title: ${post.title}
Current post content: ${post.content}
Platform: ${post.platform}
${brainBlock}
YOUR TASK — Generate COMPLETELY NEW and DIFFERENT advertising content. Follow these rules STRICTLY:

1. Write a compelling, UNIQUE English caption (2-4 sentences) for this product/topic. Use relevant emojis.
2. Write a SHORT English advertising slogan (MAXIMUM 8 words) that will be printed directly ON the image. It must be catchy and specific.
3. Write 8-12 relevant hashtags as a single string separated by spaces.
4. Translate the caption to Farsi (Persian).
5. Translate the image slogan to Farsi (Persian).
6. Write a short catchy title (max 10 words).

CRITICAL RULES:
- Content MUST be COMPLETELY DIFFERENT from the current post
- NEVER use generic phrases like "Building strong" or "Engineering excellence"
- ABSOLUTELY FORBIDDEN: Do NOT mention ANY time of day, hour, clock time, AM/PM
- FORBIDDEN WORDS: best, greatest, number one, unmatched, unparalleled, revolutionary
- Be creative, bold, and specific
- The image slogan must be short enough to be readable on an image
- SESSION CREATIVE SEED: ${sessionSeed} — use this to drive a UNIQUE creative direction
${brainKnowledge ? "- You MUST follow any brand guidelines from the Brain Context above" : ""}

Respond with ONLY a valid JSON object (no markdown, no code fences):
{"title": "...", "caption": "...", "hashtags": "...", "imageText": "...", "imageTextFa": "...", "captionFa": "..."}`;

    const captionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: captionPrompt }],
        temperature: 1.0,
      }),
    });

    if (!captionRes.ok) throw new Error(`Caption generation failed (${captionRes.status})`);

    const captionData = await captionRes.json();
    const rawContent = captionData.choices?.[0]?.message?.content || "";
    const jsonStr = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const newContent = JSON.parse(jsonStr);

    if (!newContent.caption || !newContent.imageText) throw new Error("Missing required fields in caption response");
    console.log("Generated content:", JSON.stringify({ title: newContent.title, imageText: newContent.imageText }));

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

    // Style selection with dedup
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

    // Brain image references for style inspiration
    const brainImageRefs = brainKnowledge
      ? brainKnowledge.match(/https?:\/\/\S+\.(jpg|jpeg|png|webp|svg)/gi) || []
      : [];
    const brainImageHint = brainImageRefs.length > 0
      ? `\nReference brand images for style inspiration: ${brainImageRefs.slice(0, 3).join(", ")}`
      : "";

    const imagePrompt = `MANDATORY REALISM RULE: ALL images MUST be PHOTOREALISTIC — real-world photography style ONLY. ` +
      `ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract art, AI-looking art, stock photo feel. ` +
      `Every image MUST look like it was taken by a professional photographer with a real camera at a real location.\n\n` +
      `VISUAL STYLE: ${selected.style}. ` +
      `PRODUCT/TOPIC FOCUS: ${newContent.title || post.title} for REBAR.SHOP. THEME: ${newContent.caption?.slice(0, 100)}. ` +
      `MANDATORY: Write this exact advertising text prominently on the image in a clean, bold, readable font: "${newContent.imageText}"` +
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

    console.log(`🎨 Regenerate: Using style #${selected.idx}: ${selected.style.slice(0, 60)}...`);
    const imgResult = await generatePixelImage(imagePrompt, supabase, logoUrl, { styleIndex: selected.idx });

    const imageUrl = imgResult.imageUrl || post.image_url;

    // 4. Build full content with Persian block and contact info
    const hasImageText = newContent.imageTextFa && newContent.imageTextFa.trim() !== "" && newContent.imageTextFa.trim() !== "-";
    const persianBlock = `\n\n---PERSIAN---\n` +
      (hasImageText ? `🖼️ متن روی عکس: ${newContent.imageTextFa}\n` : "") +
      `📝 ترجمه کپشن: ${newContent.captionFa || ""}`;

    const fullContent = `${newContent.caption}\n\n${newContent.hashtags || ""}${PIXEL_CONTACT_INFO}${persianBlock}`;

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
  } catch (e) {
    console.error("regenerate-post error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
