import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/aiRouter.ts";

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
  const d = new Date(baseDate);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

async function fetchBusinessIntelligence(authHeader: string): Promise<string> {
  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-intelligence`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
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

      const systemPrompt = `You are Pixel, the world's best AI social media manager for Rebar.shop — an AI-driven rebar fabrication company in Ontario.

${brandKit}

${intelligence}

COMPANY INFO (include naturally in every post):
- Address: 9 Cedar Ave, Thornhill, Ontario
- Phone: 647-260-9403
- Web: www.rebar.shop

PLATFORM-SPECIFIC RULES:
${platformRule}

Generate exactly 5 posts for ${platform} today (${dateStr}). Each post has a specific time slot, theme, and featured product.

${TIME_SLOTS.map((slot, i) => `Post ${i + 1}: ${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")} — Theme: "${slot.theme}" — Product: "${products[i]}"`).join("\n")}

CONTENT RULES:
- All content in English
- Provide a Farsi translation for each post
- Captions: scientific, promotional, beautiful language
- Strong CTAs (e.g. "Call now", "Visit rebar.shop", "Send us your barlist")
- Content must be DATA-DRIVEN — reference real business insights provided above
- For LinkedIn: B2B thought leadership, construction industry expertise, professional tone
- For Instagram: Visual-first, strong hashtag strategy
${instructionsText}

IMAGE RULES:
- REBAR.SHOP logo MUST appear in every image
- Images must be REALISTIC — construction scenes, shop floor, actual products
- NO AI-generated fantasy

Return valid JSON only. No markdown, no code blocks.
Return an array of 5 objects:
[
  {
    "time_slot": "06:30",
    "product": "Rebar Stirrups",
    "title": "Short engaging title",
    "content": "Full post content with CTA and company info",
    "farsi_translation": "Farsi version",
    "hashtags": ["#hashtag1", "#hashtag2"],
    "image_prompt": "Realistic photo prompt including REBAR.SHOP logo requirement"
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

        // Generate images using Gemini image model via gateway (image generation not supported by aiRouter)
        for (let i = 0; i < generatedPosts.length; i++) {
          const post = generatedPosts[i];
          const slot = TIME_SLOTS[i] || TIME_SLOTS[0];
          let imageUrl: string | null = null;

          if (post.image_prompt) {
            try {
              const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
              if (LOVABLE_API_KEY) {
                const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-3-pro-image-preview",
                    messages: [{
                      role: "user",
                      content: `Generate a professional social media image for ${platform}: ${post.image_prompt}. Must include REBAR.SHOP logo. Realistic construction photography, minimalist aesthetic, high quality.`,
                    }],
                    modalities: ["image", "text"],
                  }),
                });

                if (imgResponse.ok) {
                  const imgData = await imgResponse.json();
                  const images = imgData.choices?.[0]?.message?.images;
                  if (images && images.length > 0) {
                    const imageDataUrl = images[0].image_url?.url;
                    if (imageDataUrl) {
                      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
                      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
                      const imagePath = `auto/${platform}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
                      const { error: uploadError } = await supabaseAdmin.storage
                        .from("social-images")
                        .upload(imagePath, imageBytes, { contentType: "image/png" });
                      if (!uploadError) {
                        const { data: urlData } = supabaseAdmin.storage.from("social-images").getPublicUrl(imagePath);
                        imageUrl = urlData.publicUrl;
                      }
                    }
                  } else {
                    const parts = imgData.choices?.[0]?.message?.parts;
                    if (parts) {
                      for (const part of parts) {
                        if (part.inline_data?.data) {
                          const imageBytes = Uint8Array.from(atob(part.inline_data.data), (c) => c.charCodeAt(0));
                          const imagePath = `auto/${platform}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
                          const { error: uploadError } = await supabaseAdmin.storage
                            .from("social-images")
                            .upload(imagePath, imageBytes, { contentType: "image/png" });
                          if (!uploadError) {
                            const { data: urlData } = supabaseAdmin.storage.from("social-images").getPublicUrl(imagePath);
                            imageUrl = urlData.publicUrl;
                          }
                          break;
                        }
                      }
                    }
                  }
                }
              }
            } catch (imgErr) {
              console.error("Image generation failed (non-critical):", imgErr);
            }
          }

          const scheduledAt = buildScheduledDate(postDate, slot.hour, slot.minute);

          const { data: insertedPost, error: insertError } = await supabaseAdmin
            .from("social_posts")
            .insert({
              user_id: userId,
              platform,
              title: post.title || "Untitled",
              content: post.content || "",
              hashtags: post.hashtags || [],
              image_url: imageUrl,
              status: "pending_approval",
              scheduled_date: scheduledAt,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Failed to insert post:", insertError);
            continue;
          }

          // Create approval record for configured approvers
          try {
            // Find admin users to be approvers (scoped via profiles)
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

            // Notify approvers
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
