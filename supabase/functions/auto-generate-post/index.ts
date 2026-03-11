import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import {
  generatePixelImage,
  resolveLogoUrl,
  fetchRecentPixelImages,
  selectVisualStyle,
  buildPixelImagePrompt,
  PIXEL_VISUAL_STYLES,
} from "../_shared/pixelImageGenerator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error("auto-generate-post auth failed:", error?.message);
    return null;
  }
  return user.id;
}

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

    // Fetch business intelligence + brand kit in parallel
    const [intelligence, brandKit] = await Promise.all([
      fetchBusinessIntelligence(authHeader),
      fetchBrandKit(supabaseAdmin, userId),
    ]);

    const products = pickUniqueProducts(TIME_SLOTS.length);
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
- Scientific, promotional, beautiful language

### FORBIDDEN WORDS/PHRASES (NEVER USE):
"guaranteed", "we guarantee", "100% guaranteed", "ensure", "we ensure", "promise", "we promise", "100% safe", "zero defects", "never fails"

### ALLOWED ALTERNATIVES:
"designed for", "built for", "engineered for", "precision-crafted", "trusted by", "relied upon by", "crafted for performance"

### MANDATORY CONTENT STRUCTURE (for each post's "content" field):
1. Compelling hook (question, stat, or bold statement)
2. Product-focused promotional text (2-3 sentences)
3. Contact info block (MUST include):
   📍 9 Cedar Ave, Thornhill, Ontario
   📞 647-260-9403
   🌐 www.rebar.shop

## IMAGE PROMPT RULES
- ALL images MUST be PHOTOREALISTIC — real-world professional photography style ONLY
- ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract, AI-looking art, stock photo aesthetics
- Every image MUST look like a real photo taken with a professional camera at a real construction site, workshop, warehouse, or urban location
- Natural lighting, real textures, authentic environments ONLY
- The REBAR.SHOP logo MUST appear in EVERY image — no changes to color, shape, or design
- English text overlays on the image (product name, tagline)
- Each image MUST use a DIFFERENT visual style — never repeat compositions
${instructionsText}

Return valid JSON only. No markdown, no code blocks.
Return an array of 5 objects:
[
  {
    "time_slot": "06:30",
    "product": "Rebar Stirrups",
    "title": "Short engaging title",
    "content": "Full caption with hook + promo text + contact info (📍📞🌐) + CTA",
    "farsi_translation": "---PERSIAN---\\n🖼️ متن روی عکس: [Farsi of image text]\\n📝 ترجمه کپشن: [Farsi of caption]",
    "hashtags": ["#RebarShop", "#ConstructionToronto", "..."],
    "image_prompt": "PHOTOREALISTIC: [detailed scene with specific visual style, product, REBAR.SHOP logo, English text overlay]"
  }
]`;

      try {
        const aiResult = await callAI({
          provider: "gemini",
          model: "gemini-2.5-flash",
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

        // Resolve logo + recent images for dedup (once per platform loop)
        const [logoUrl, recentImageNames] = await Promise.all([
          resolveLogoUrl(),
          fetchRecentPixelImages(supabaseAdmin),
        ]);

        for (let i = 0; i < generatedPosts.length; i++) {
          const post = generatedPosts[i];
          const slot = TIME_SLOTS[i] || TIME_SLOTS[0];
          let imageUrl: string | null = null;

          const scheduledAt = buildScheduledDate(postDate, slot.hour, slot.minute);

          // Insert post first (text-only)
          const { data: insertedPost, error: insertError } = await supabaseAdmin
            .from("social_posts")
            .insert({
              user_id: userId,
              platform,
              title: post.title || "Untitled",
              content: post.content || "",
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

          // Generate image using Pixel's full pipeline (retry + logo + dedup)
          if (post.image_prompt) {
            try {
              console.log(`Generating Pixel-quality image for post ${i + 1}/${generatedPosts.length}...`);

              const { style: selectedStyle, index: selectedStyleIndex } = selectVisualStyle(recentImageNames);

              const dedupHint = recentImageNames.length > 0
                ? `\n\nPREVIOUSLY GENERATED (MUST NOT resemble any of these — use completely different composition, angle, color scheme): ${recentImageNames.slice(0, 15).join(", ")}`
                : "";

              const usedStyleIndices = new Set<number>();
              for (const name of recentImageNames) {
                const match = name.match(/-s(\d+)-/);
                if (match) usedStyleIndices.add(parseInt(match[1]));
              }
              const forbiddenStyles = [...usedStyleIndices]
                .map(idx => PIXEL_VISUAL_STYLES[idx])
                .filter(Boolean)
                .slice(0, 5);
              const forbiddenHint = forbiddenStyles.length > 0
                ? `\nFORBIDDEN STYLES (already used recently, DO NOT use): ${forbiddenStyles.join("; ")}`
                : "";

              const sessionSeed = `auto-${crypto.randomUUID()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

              const pixelPrompt = buildPixelImagePrompt({
                product: post.product || products[i] || "Rebar Products",
                theme: slot.theme,
                imageText: post.title || "REBAR.SHOP",
                selectedStyle,
                dedupHint,
                forbiddenHint,
                sessionSeed,
              });

              const imgResult = await generatePixelImage(pixelPrompt, supabaseAdmin, logoUrl, { styleIndex: selectedStyleIndex });

              if (imgResult.imageUrl) {
                imageUrl = imgResult.imageUrl;
                await supabaseAdmin
                  .from("social_posts")
                  .update({ image_url: imageUrl })
                  .eq("id", insertedPost.id);
                console.log(`Pixel image uploaded for post ${i + 1}`);
                recentImageNames.unshift(`${Date.now()}-s${selectedStyleIndex}-batch.png`);
              } else {
                console.error("Pixel image generation failed:", imgResult.error);
              }
            } catch (imgErr) {
              console.error("Image generation error (non-critical):", imgErr);
            }
          }
            } catch (imgErr) {
              console.error("Image generation error (non-critical):", imgErr);
            }
          }

          // Create approval record for configured approvers
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
            image_url: imageUrl || insertedPost.image_url,
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
