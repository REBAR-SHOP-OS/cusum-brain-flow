import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRODUCT_CATALOG = [
  "Rebar Fiberglass Straight",
  "Rebar Stirrups",
  "Rebar Cages",
  "Rebar Hooks",
  "Rebar Hooked Anchor Bar",
  "Wire Mesh",
  "Rebar Dowels",
  "Standard Dowels 4x16",
  "Circular Ties/Bars",
  "Rebar Straight",
];

const TIME_SLOTS = [
  { hour: 6, minute: 30, theme: "Motivational / self-care / start of work day" },
  { hour: 7, minute: 30, theme: "Creative promotional post" },
  { hour: 8, minute: 0, theme: "Inspirational — emphasizing strength & scale" },
  { hour: 12, minute: 30, theme: "Inspirational — emphasizing innovation & efficiency" },
  { hour: 14, minute: 30, theme: "Creative promotional for company products" },
];

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { platforms = ["facebook"], customInstructions = "", scheduledDate } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const postDate = scheduledDate || new Date().toISOString();
    const dateStr = new Date(postDate).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    // Pick 5 unique products for the 5 slots
    const products = pickUniqueProducts(TIME_SLOTS.length);
    const platform = platforms[0] || "facebook";

    const instructionsText = customInstructions ? `\nCustom instructions: ${customInstructions}` : "";

    const systemPrompt = `You are Pixel, an expert social media manager for Ontario Steels / Rebar.shop — an AI-driven rebar fabrication company.

COMPANY INFO (include naturally in every post):
- Address: 9 Cedar Ave, Thornhill, Ontario
- Phone: 647-260-9403
- Web: www.rebar.shop

Generate exactly 5 posts for today (${dateStr}). Each post has a specific time slot, theme, and featured product.

${TIME_SLOTS.map((slot, i) => `Post ${i + 1}: ${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")} — Theme: "${slot.theme}" — Product: "${products[i]}"`).join("\n")}

CONTENT RULES:
- All content in English
- Provide a Farsi translation for each post (display only, not for upload)
- Captions: scientific, promotional, beautiful language
- Strong CTAs (e.g. "Call now", "Visit rebar.shop", "Send us your barlist")
- Hashtags required on every post
- Platform: ${platform}
${instructionsText}

IMAGE RULES:
- Company logo (REBAR.SHOP) MUST appear in every image
- Images must be REALISTIC — construction scenes, shop floor, actual products
- Inspired by nature + minimalist art aesthetic
- NO AI-generated fantasy — describe real photo scenarios

Return valid JSON only. No markdown, no code blocks.
Return an array of 5 objects:
[
  {
    "time_slot": "06:30",
    "product": "Rebar Stirrups",
    "title": "Short engaging title",
    "content": "Full post content with CTA and company info",
    "farsi_translation": "Farsi version of content",
    "hashtags": ["#hashtag1", "#hashtag2"],
    "image_prompt": "Realistic photo prompt including REBAR.SHOP logo requirement"
  }
]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate today's 5 social media posts. Make them fresh, engaging, and ready for approval.` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let generatedPosts: Array<{
      time_slot: string;
      product: string;
      title: string;
      content: string;
      farsi_translation?: string;
      hashtags: string[];
      image_prompt?: string;
    }> = [];

    try {
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      generatedPosts = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("AI returned invalid format. Please try again.");
    }

    if (!Array.isArray(generatedPosts) || generatedPosts.length === 0) {
      throw new Error("AI didn't generate any posts. Please try again.");
    }

    const createdPosts = [];

    for (let i = 0; i < generatedPosts.length; i++) {
      const post = generatedPosts[i];
      const slot = TIME_SLOTS[i] || TIME_SLOTS[0];
      let imageUrl: string | null = null;

      if (post.image_prompt) {
        try {
          const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: `Generate a professional social media image: ${post.image_prompt}. Must include REBAR.SHOP logo. Realistic construction photography, minimalist aesthetic.` }],
            }),
          });

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            const parts = imgData.choices?.[0]?.message?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inline_data?.data) {
                  const imageBytes = Uint8Array.from(atob(part.inline_data.data), c => c.charCodeAt(0));
                  const imagePath = `social-media/auto/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
                  const { error: uploadError } = await supabaseAdmin.storage
                    .from("estimation-files")
                    .upload(imagePath, imageBytes, { contentType: "image/png" });
                  if (!uploadError) {
                    const { data: urlData } = supabaseAdmin.storage.from("estimation-files").getPublicUrl(imagePath);
                    imageUrl = urlData.publicUrl;
                  }
                  break;
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
          status: "draft",
          scheduled_date: scheduledAt,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to insert post:", insertError);
        continue;
      }

      createdPosts.push({
        ...insertedPost,
        time_slot: post.time_slot,
        product: post.product,
        farsi_translation: post.farsi_translation,
        image_prompt: post.image_prompt,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        postsCreated: createdPosts.length,
        posts: createdPosts,
        message: `Pixel generated ${createdPosts.length} post(s) for your approval!`,
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
