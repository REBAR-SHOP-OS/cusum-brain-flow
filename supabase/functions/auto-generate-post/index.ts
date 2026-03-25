import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

// buildEventPromptBlock removed — events are opt-in via chat only

/** Resolve company logo URL from storage (same as Pixel agent) */
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

/** Fetch brain knowledge: custom instructions + resource image URLs */
async function fetchBrainContext(supabase: ReturnType<typeof createClient>): Promise<{
  customInstructions: string;
  resourceImageUrls: string[];
}> {
  let customInstructions = "";
  const resourceImageUrls: string[] = [];
  try {
    // Fetch text knowledge
    const { data: brainItems } = await supabase
      .from("knowledge")
      .select("title, content, category, metadata, source_url")
      .order("created_at", { ascending: false });

    if (brainItems) {
      const socialItems = brainItems.filter(
        (item: any) => (item.metadata as any)?.agent === "social"
      );
      const instructions = socialItems.find(
        (item: any) => (item.metadata as any)?.type === "instructions"
      );
      if (instructions?.content) {
        customInstructions = instructions.content;
      }
    }

    // Fetch image resources
    const { data: imgKnowledge } = await supabase
      .from("knowledge")
      .select("source_url, metadata")
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
          if (signedData?.signedUrl) { resourceImageUrls.push(signedData.signedUrl); continue; }
        }
        if (item.source_url.includes("/object/public/")) {
          try { const h = await fetch(item.source_url, { method: "HEAD" }); if (h.ok) resourceImageUrls.push(item.source_url); } catch {}
        }
      }
    }
  } catch (e) {
    console.warn("Could not fetch brain context:", e);
  }
  // Filter out SVGs
  const filtered = resourceImageUrls.filter(u => !/\.svg(\?|$)/i.test(u));
  console.log(`Brain: instructions=${customInstructions.length > 0 ? "yes" : "no"}, images=${filtered.length}`);
  return { customInstructions, resourceImageUrls: filtered };
}

/** Strip Persian translation block — never store/publish Persian text */
function stripPersianBlock(text: string): string {
  let t = text;
  const idx = t.indexOf("---PERSIAN---");
  if (idx !== -1) t = t.slice(0, idx);
  t = t.replace(/🖼️\s*متن روی عکس:[\s\S]*/m, "");
  t = t.replace(/📝\s*ترجمه کپشن:[\s\S]*/m, "");
  return t.trim();
}

const PRODUCT_CATALOG = [
  "Rebar Fiberglass Straight", "Rebar Stirrups", "Rebar Cages", "Rebar Hooks",
  "Rebar Hooked Anchor Bar", "Wire Mesh", "Rebar Dowels", "Standard Dowels 4x16",
  "Circular Ties/Bars", "Rebar Straight",
];

const TIME_SLOTS = [
  { hour: 6, minute: 30, theme: "Motivational / self-care / start of work day" },
  { hour: 7, minute: 30, theme: "Creative promotional post" },
  { hour: 8, minute: 0, theme: "Inspirational — emphasizing strength & scale" },
  { hour: 12, minute: 30, theme: "Inspirational — emphasizing innovation & efficiency" },
  { hour: 14, minute: 30, theme: "Creative promotional for company products" },
];

const PLATFORM_RULES: Record<string, string> = {
  unassigned: "General social media: Write a versatile caption suitable for any platform. Medium length (200-400 words). Professional yet engaging tone. Strong CTA. Can be adapted later for specific platforms.",
  facebook: "Facebook: Longer captions OK (up to 500 words). Community-focused, conversational, storytelling. Tag pages, use emojis moderately. Image-first but text posts also work.",
  instagram: "Instagram: Visual-first. Caption max 2200 chars. Up to 30 hashtags (use 15-20 relevant ones). Strong CTA. Story-style hooks. Carousel-friendly formatting.",
  linkedin: "LinkedIn: Professional B2B tone. Thought leadership angle. Construction industry expertise. Longer-form OK (up to 1300 chars for high engagement). No hashtag spam (3-5 max). Hook in first line. Line breaks for readability. End with engagement question.",
  twitter: "Twitter/X: Max 280 chars. Punchy, direct. Thread-ready hooks. 1-2 hashtags max. Link to website. Engagement-first.",
};

function pickUniqueProducts(count: number): string[] {
  const shuffled = [...PRODUCT_CATALOG].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function buildScheduledDate(baseDate: string, hour: number, minute: number): string {
  // Parse base date components to avoid UTC-shift from Date constructor
  const d = new Date(baseDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  // Eastern Time offset: EDT = -04:00 (Mar–Nov), EST = -05:00 (Nov–Mar)
  // March 10 2026 is EDT
  const eastern = new Date(
    `${year}-${month}-${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`
  );
  return eastern.toISOString();
}

// verifyAuth removed — handled by handleRequest wrapper

async function fetchBusinessIntelligence(authHeader: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-intelligence`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return "";
    const data = await res.json();

    const parts: string[] = [];
    if (data.trendingSummary) parts.push(`BUSINESS INTELLIGENCE: ${data.trendingSummary}`);
    if (data.searchConsole?.topQueries?.length > 0) {
      parts.push(`TOP SEARCH QUERIES (use these topics!): ${data.searchConsole.topQueries.slice(0, 5).map((q: any) => `"${q.query}" (${q.clicks} clicks)`).join(", ")}`);
    }
    if (data.topLeads?.length > 0) {
      parts.push(`HOT LEADS: ${data.topLeads.slice(0, 3).map((l: any) => `${l.title} ($${l.value})`).join(", ")}`);
    }
    if (data.customerQuestions?.length > 0) {
      parts.push(`CUSTOMER QUESTIONS (address these!): ${data.customerQuestions.slice(0, 3).join("; ")}`);
    }
    return parts.join("\n");
  } catch {
    return "";
  }
}

async function fetchBrandKit(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("brand_kit")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return "";
    return `BRAND KIT:
- Business: ${data.business_name}
- Voice: ${data.brand_voice}
- Description: ${data.description}
- Value Prop: ${data.value_prop}
- Colors: ${JSON.stringify(data.colors)}`;
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization")!;
    const body = await req.json();
    const { platforms = ["facebook", "instagram", "linkedin"], customInstructions = "", scheduledDate } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const postDate = scheduledDate || new Date().toISOString();
    const dateStr = new Date(postDate).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    // Fetch business intelligence + brand kit + logo + brain in parallel
    const [intelligence, brandKit, logoUrl, brainCtx] = await Promise.all([
      fetchBusinessIntelligence(authHeader),
      fetchBrandKit(supabaseAdmin, userId),
      resolveLogoUrl(),
      fetchBrainContext(supabaseAdmin),
    ]);

    const products = pickUniqueProducts(TIME_SLOTS.length);
    const brainInstructionsText = brainCtx.customInstructions
      ? `\n## USER IMAGE INSTRUCTIONS (MUST FOLLOW STRICTLY):\n${brainCtx.customInstructions}\n`
      : "";
    const instructionsText = customInstructions ? `\nCustom instructions: ${customInstructions}` : "";

    // Generate for EACH platform
    const allCreatedPosts: any[] = [];

    for (const platform of platforms) {
      const platformRule = PLATFORM_RULES[platform] || PLATFORM_RULES.facebook;

      const VISUAL_STYLES = [
        "Realistic workshop/fabrication shop interior, real workers cutting and bending steel rebar, sparks flying, industrial atmosphere, warm tungsten lighting, professional DSLR camera",
        "Active construction site with tower cranes, large-scale concrete pour in progress, steel reinforcement visible, workers in safety gear, dynamic composition",
        "Urban cityscape with buildings under construction, skyline showing steel framework and concrete structures, city life in foreground",
        "Aerial drone view of a massive construction project, bird's eye perspective showing rebar grid layout on foundation, geometric patterns",
        "Real product photography in actual warehouse/shop environment, steel products on real industrial surface with natural lighting",
        "Macro close-up of real steel components, extreme detail of rebar texture, welding points, wire mesh intersections, shallow depth of field",
        "Dramatic sunrise/sunset at real construction site, silhouette of steel structure against colorful sky, golden hour natural lighting, cinematic photography",
        "Real logistics & delivery scene, flatbed truck loaded with bundled rebar arriving at actual site, warehouse operations, professional documentary photography",
        "Engineering blueprints laid on real workbench with physical steel products on top, real office/workshop environment, natural lighting",
        "Night construction scene at real site, illuminated with flood lights creating dramatic shadows, urban night atmosphere",
        "Ground-level photography inside deep foundation excavation, rebar cages inside foundation forms, real concrete work",
        "City landmarks & infrastructure, bridge or overpass showcasing exposed steel reinforcement, dramatic perspective",
      ];
      // Pick diverse styles for each slot
      const shuffledStyles = [...VISUAL_STYLES].sort(() => Math.random() - 0.5);

      // Event context removed from auto-generate — posts are purely promotional by default
      // Events are only used when user explicitly requests them via chat

      const systemPrompt = `You are **Pixel**, a professional social media content generator for REBAR.SHOP — an AI-driven rebar fabrication company in Ontario.

${brandKit}

${intelligence}

## CONTACT INFO (MUST appear in EVERY post caption — exactly as shown):
📍 9 Cedar Ave, Thornhill, Ontario
📞 647-260-9403
🌐 www.rebar.shop

## PLATFORM-SPECIFIC RULES:
${platformRule}

Generate exactly 5 posts for ${platform} today (${dateStr}). Each post has a specific time slot, theme, featured product, and visual style.

${TIME_SLOTS.map((slot, i) => `Post ${i + 1}: ${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")} — Theme: "${slot.theme}" — Product: "${products[i]}" — Visual Style: "${shuffledStyles[i % shuffledStyles.length]}"`).join("\n")}

## CAPTION RULES
- Language: English only. The caption MUST be purely promotional.
- Strong CTAs (e.g. "Call now at 647-260-9403", "Visit rebar.shop", "Send us your barlist")
- Content must be DATA-DRIVEN — reference real business insights provided above
- PURELY PROMOTIONAL & ADVERTISING style — catchy, bold, emotional appeal. Do NOT explain how the product works scientifically. Focus on WHY the customer should buy.

### ABSOLUTELY FORBIDDEN CONTENT:
Scientific explanations, technical specifications, engineering terminology, material properties, structural analysis claims. Do NOT describe tensile strength, load-bearing capacity, or any technical process.

### FORBIDDEN WORDS/PHRASES (NEVER USE):
"guaranteed", "we guarantee", "100% guaranteed", "ensure", "we ensure", "promise", "we promise", "100% safe", "zero defects", "never fails", "unparalleled", "revolutionary", "superior", "structural integrity", "load-bearing", "tensile strength", "AI-driven", "precision-engineered", "interlocks", "scientifically", "unmatched", "finest", "unbeatable"

### ALLOWED ALTERNATIVES:
"designed for", "built for", "crafted for", "trusted by", "relied upon by", "crafted for performance", "your go-to choice"

### MANDATORY CONTENT STRUCTURE (for each post's "content" field):
1. Compelling hook (question, stat, or bold statement)
2. Product-focused promotional text (2-3 sentences)
3. Contact info block (MUST include):
   📍 9 Cedar Ave, Thornhill, Ontario
   📞 647-260-9403
   🌐 www.rebar.shop

## IMAGE RULES
- **ALL images MUST be PHOTOREALISTIC** — real-world professional photography style ONLY. ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract, AI-looking art, stock photo aesthetics. Every image MUST look like a real photo taken with a professional camera at a real construction site, workshop, warehouse, or urban location. Natural lighting, real textures, authentic environments ONLY.
- **LOGO IS MANDATORY** — The REBAR.SHOP logo MUST appear in EVERY image EXACTLY as the original — no changes to color, shape, aspect ratio, or design. If the logo cannot be loaded, DO NOT generate any image — report the error immediately.
- **EVERY image MUST be visually UNIQUE** — Different composition, color palette, camera angle, lighting, and layout from ALL previous generations. NEVER produce a similar-looking image. Each generation must feel like a completely fresh creative direction.
- **USE DIVERSE VISUAL STYLES** — Rotate between these styles and NEVER use the same style twice in a row: realistic workshop/fabrication scenes, active construction sites with cranes, urban cityscapes with buildings under construction, city landmarks & bridges & infrastructure, aerial drone views of large projects, real product photography in actual warehouse settings, macro close-up detail shots, dramatic sunrise/sunset lighting, logistics & delivery scenes, engineering blueprints overlaid with real products, night construction scenes, foundation-level perspectives. Each image must look like it came from a COMPLETELY DIFFERENT photo shoot. Each post's image_prompt MUST explicitly reference the assigned visual_style for that time slot.
- English text overlays on the image (product name, tagline)
- Purely promotional advertising style — NOT fantasy, cartoon, or scientific/technical
- Clean, professional, visually striking — like professional documentary/commercial photography
- Use Brain files (logo & content reference) when available
${brainInstructionsText}${instructionsText}

## 🚨 SLOGAN vs CAPTION — ZERO OVERLAP RULE 🚨
The "image_slogan" is a SHORT billboard tagline (max 6 words) printed ON the image.
The "content" is a FULL promotional paragraph (2-4 sentences) about REBAR.SHOP services.
They MUST have ZERO overlapping phrases. They MUST convey COMPLETELY DIFFERENT messages.

❌ VIOLATION EXAMPLE (FORBIDDEN):
  image_slogan: "Spring into Action!"
  content: "Spring into action with Ontario Steels! New beginnings, stronger builds!"
  → THIS IS A VIOLATION because the caption repeats/paraphrases the slogan.

✅ CORRECT EXAMPLE:
  image_slogan: "Steel That Builds Dreams"
  content: "From stirrups to dowels, REBAR.SHOP delivers everything your project needs — fast, reliable, right to your site. Browse our full range at www.rebar.shop 📞 647-260-9403"
  → The slogan is a catchy tagline. The caption describes services and products. ZERO overlap.

Return valid JSON only. No markdown, no code blocks.
Return an array of 5 objects:
[
  {
    "time_slot": "06:30",
    "product": "Rebar Stirrups",
    "title": "Short engaging title",
    "image_slogan": "Max 6 words billboard tagline for image overlay — catchy, emotional, NO technical jargon",
    "content": "Full promotional caption (2-4 sentences) describing REBAR.SHOP services, delivery speed, product range, customer benefits + contact info (📍📞🌐) + CTA. MUST be COMPLETELY DIFFERENT from image_slogan — ZERO overlapping words or phrases.",
    "farsi_translation": "---PERSIAN---\\n🖼️ متن روی عکس: [Premium-quality fluent Farsi of image slogan — NOT literal translation, must sound like native Persian copywriting]\\n📝 ترجمه کپشن: [Premium-quality fluent Farsi of caption — elegant, professional Persian that reads as if originally written by a native Persian advertising copywriter]",
    "hashtags": ["#RebarShop", "#ConstructionToronto", "..."],
    "image_prompt": "PHOTOREALISTIC: [detailed scene with specific visual style, product, REBAR.SHOP logo, and the EXACT text from image_slogan rendered in clean bold font]"
  }
]
`;

      try {
        const aiResult = await callAI({
          provider: "gemini",
          model: "gemini-2.5-flash",
          agentName: "social",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate today's 5 ${platform} posts. Make them fresh, data-driven, and platform-optimized.` },
          ],
        });

        const rawContent = aiResult.content;

        let generatedPosts: any[] = [];
        try {
          const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
          generatedPosts = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawContent);
        } catch {
          console.error(`Failed to parse AI response for ${platform}:`, rawContent);
          continue;
        }

        if (!Array.isArray(generatedPosts) || generatedPosts.length === 0) continue;

        // Post-processing: enforce slogan/caption separation
        for (const post of generatedPosts) {
          // If AI returned image_slogan, ensure content doesn't overlap
          const slogan = (post.image_slogan || "").toLowerCase().trim();
          const caption = (post.content || "").toLowerCase();
          if (slogan && caption) {
            const sloganWords = slogan.split(/\s+/).filter((w: string) => w.length > 3);
            const captionWords = caption.split(/\s+/);
            const overlap = sloganWords.filter((w: string) => captionWords.includes(w));
            const overlapRatio = sloganWords.length > 0 ? overlap.length / sloganWords.length : 0;
            if (overlapRatio > 0.4) {
              console.warn(`⚠️ Slogan/caption overlap detected (${Math.round(overlapRatio * 100)}%): "${post.image_slogan}" vs caption. Stripping slogan phrases from caption.`);
              // Remove slogan phrases from caption start
              let cleaned = post.content;
              for (const word of sloganWords) {
                const re = new RegExp(`\\b${word}\\b`, "gi");
                const firstSentenceEnd = cleaned.indexOf(". ");
                if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
                  const firstSentence = cleaned.slice(0, firstSentenceEnd);
                  if (firstSentence.toLowerCase().includes(word)) {
                    cleaned = cleaned.slice(firstSentenceEnd + 2);
                  }
                }
              }
              post.content = cleaned.trim() || post.content;
            }
          }
        }

        // Create posts and generate images via Lovable AI
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        // Phase 1: Insert ALL text-only posts first (fast, ~2s total)
        const insertedPosts: { post: any; insertedPost: any; index: number }[] = [];
        for (let i = 0; i < generatedPosts.length; i++) {
          const post = generatedPosts[i];
          const slot = TIME_SLOTS[i] || TIME_SLOTS[0];
          const scheduledAt = buildScheduledDate(postDate, slot.hour, slot.minute);

          const { data: insertedPost, error: insertError } = await supabaseAdmin
            .from("social_posts")
            .insert({
              user_id: userId,
              platform,
              title: post.title || "Untitled",
              content: stripPersianBlock(post.content || ""),
              hashtags: post.hashtags || [],
              image_url: null,
              status: "pending_approval",
              scheduled_date: scheduledAt,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Failed to insert post:", insertError);
            continue;
          }
          insertedPosts.push({ post, insertedPost, index: i });
        }

        // Phase 2: Generate images in PARALLEL batches of 2
        const BATCH_SIZE = 2;
        async function generateAndUploadImage(
          post: any, insertedPost: any, idx: number
        ): Promise<string | null> {
          if (!LOVABLE_API_KEY || !post.image_prompt) return null;
          try {
            console.log(`Generating image for post ${idx + 1}/${generatedPosts.length}...`);

            // Build multimodal content with logo + brain refs
            const fullPrompt = brainInstructionsText + post.image_prompt;
            const contentParts: any[] = [{ type: "text", text: fullPrompt }];

            if (logoUrl) {
              contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
              contentParts.push({
                type: "text",
                text: "CRITICAL: Place this EXACT logo image as-is in the generated image, in a visible corner as a watermark. " +
                  "Do NOT modify, distort, recreate, or redraw the logo. Use ONLY the provided logo image. " +
                  "Do NOT add text-based watermarks.",
              });
            }

            // Attach up to 3 brain resource images as visual references
            for (const refUrl of brainCtx.resourceImageUrls.slice(0, 3)) {
              contentParts.push({ type: "image_url", image_url: { url: refUrl } });
            }
            if (brainCtx.resourceImageUrls.length > 0) {
              contentParts.push({
                type: "text",
                text: "The above reference images show REAL products and brand style. Use them as visual inspiration for composition, product appearance, and brand identity.",
              });
            }

            // Try with logo/refs first, fallback to text-only on failure
            let imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-image",
                messages: [{ role: "user", content: contentParts }],
                modalities: ["image", "text"],
              }),
            });

            // Fallback: if multimodal fails and we had attachments, retry text-only
            if (!imgResp.ok && (logoUrl || brainCtx.resourceImageUrls.length > 0)) {
              console.warn(`Multimodal image gen failed (${imgResp.status}), retrying text-only...`);
              imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash-image",
                  messages: [{ role: "user", content: fullPrompt }],
                  modalities: ["image", "text"],
                }),
              });
            }

            if (!imgResp.ok) {
              console.error("Image generation failed:", imgResp.status, await imgResp.text());
              return null;
            }

            const imgData = await imgResp.json();
            const b64Url = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (!b64Url) return null;

            const base64Data = b64Url.replace(/^data:image\/\w+;base64,/, "");
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
            const blob = new Blob([bytes], { type: "image/png" });

            const fileName = `images/${crypto.randomUUID()}.png`;
            const { error: uploadErr } = await supabaseAdmin.storage
              .from("social-media-assets")
              .upload(fileName, blob, { contentType: "image/png", upsert: false });

            if (uploadErr) {
              console.error("Storage upload error:", uploadErr);
              return null;
            }

            const { data: pubUrl } = supabaseAdmin.storage
              .from("social-media-assets")
              .getPublicUrl(fileName);
            const imageUrl = pubUrl.publicUrl;

            await supabaseAdmin
              .from("social_posts")
              .update({ image_url: imageUrl })
              .eq("id", insertedPost.id);

            console.log(`Image uploaded for post ${idx + 1}: ${fileName}`);
            return imageUrl;
          } catch (imgErr) {
            console.error("Image generation error (non-critical):", imgErr);
            return null;
          }
        }

        // Process images in batches of 2 for parallelism
        for (let b = 0; b < insertedPosts.length; b += BATCH_SIZE) {
          const batch = insertedPosts.slice(b, b + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(({ post, insertedPost, index }) =>
              generateAndUploadImage(post, insertedPost, index)
            )
          );
          // Store image URLs back
          batch.forEach(({ insertedPost }, bi) => {
            const r = results[bi];
            if (r.status === "fulfilled" && r.value) {
              insertedPost.image_url = r.value;
            }
          });
        }

        // Phase 3: Create approval records for all inserted posts
        for (const { post, insertedPost } of insertedPosts) {
          try {
            const { data: adminProfiles } = await supabaseAdmin
              .from("profiles")
              .select("user_id, user_roles!inner(role)")
              .eq("is_active", true);
            const admins = (adminProfiles || [])
              .filter((p: any) => p.user_roles?.some((r: any) => ["admin", "sales"].includes(r.role)));

            const approverIds = admins.map((a: any) => a.user_id).filter((id: any) => id !== userId) || [];

            for (const approverId of approverIds.slice(0, 2)) {
              await supabaseAdmin.from("social_approvals").insert({
                post_id: insertedPost.id,
                approver_id: approverId,
                status: "pending",
                deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
              });
            }

            if (approverIds.length > 0) {
              try {
                await fetch(
                  `${Deno.env.get("SUPABASE_URL")}/functions/v1/approval-notify`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      post_id: insertedPost.id,
                      approver_ids: approverIds.slice(0, 2),
                      mode: "notify",
                    }),
                  }
                );
              } catch (notifyErr) {
                console.error("Approval notification failed (non-critical):", notifyErr);
              }
            }
          } catch (approvalErr) {
            console.error("Approval record creation failed (non-critical):", approvalErr);
          }

          allCreatedPosts.push({
            ...insertedPost,
            time_slot: post.time_slot,
            product: post.product,
            farsi_translation: post.farsi_translation,
          });
        }
      } catch (e) {
        if (e instanceof AIError) {
          return new Response(JSON.stringify({ error: e.message }), {
            status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI error for platform", platform, e);
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        postsCreated: allCreatedPosts.length,
        platforms,
        posts: allCreatedPosts,
        message: `Pixel generated ${allCreatedPosts.length} post(s) across ${platforms.length} platform(s) for your approval!`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-generate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
