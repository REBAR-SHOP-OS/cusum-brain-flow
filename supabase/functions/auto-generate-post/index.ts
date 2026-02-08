import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      platforms = ["facebook", "instagram"],
      themes = [],
      customInstructions = "",
      scheduledDate,
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get today's date for scheduling
    const postDate = scheduledDate || new Date().toISOString();
    const dateStr = new Date(postDate).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Build the prompt
    const themesText = themes.length > 0
      ? `Focus on these content themes:\n${themes.map((t: string) => `- ${t}`).join("\n")}`
      : "Create diverse business-relevant content about rebar fabrication, steel detailing, and construction industry.";

    const instructionsText = customInstructions
      ? `\n\nCustom instructions from the user: ${customInstructions}`
      : "";

    const platformList = platforms.join(", ");

    const systemPrompt = `You are Pixel, an expert social media manager for a rebar fabrication and steel detailing company called Ontario Steels / Rebar.shop. 

Your job is to create engaging, professional social media posts. Each post should be unique and valuable.

${themesText}
${instructionsText}

Create exactly ${platforms.length} post(s) — one for each platform: ${platformList}.

For each post, tailor the content style to the platform:
- Facebook: Professional, informative, can be longer
- Instagram: Visual-focused caption, engaging, uses relevant hashtags
- LinkedIn: Industry thought leadership, professional tone
- Twitter/X: Concise, punchy, under 280 chars
- TikTok: Trendy, casual, hook-driven
- YouTube: Descriptive title and description

Today's date: ${dateStr}

IMPORTANT: Return valid JSON only. No markdown, no code blocks.
Return an array of objects with these exact fields:
[
  {
    "platform": "facebook",
    "title": "Short engaging title",
    "content": "Full post content",
    "hashtags": ["#hashtag1", "#hashtag2"],
    "image_prompt": "A detailed prompt to generate an image for this post"
  }
]`;

    // Call AI to generate posts
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
          { role: "user", content: `Generate today's social media posts for: ${platformList}. Make them fresh, engaging, and ready for my approval.` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response - extract JSON array
    let generatedPosts: Array<{
      platform: string;
      title: string;
      content: string;
      hashtags: string[];
      image_prompt?: string;
    }> = [];

    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedPosts = JSON.parse(jsonMatch[0]);
      } else {
        generatedPosts = JSON.parse(rawContent);
      }
    } catch (parseErr) {
      console.error("Failed to parse AI response:", rawContent);
      throw new Error("AI returned invalid format. Please try again.");
    }

    if (!Array.isArray(generatedPosts) || generatedPosts.length === 0) {
      throw new Error("AI didn't generate any posts. Please try again.");
    }

    // Generate images for each post
    const createdPosts = [];

    for (const post of generatedPosts) {
      let imageUrl: string | null = null;

      // Try to generate an image if we have a prompt
      if (post.image_prompt) {
        try {
          const imgResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [
                {
                  role: "user",
                  content: `Generate a professional, high-quality social media image: ${post.image_prompt}. Style: modern, clean, professional photography or illustration. No text overlays.`,
                },
              ],
            }),
          });

          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            // Check if we got an image back (base64 in content)
            const imgContent = imgData.choices?.[0]?.message?.content;
            if (imgContent) {
              // Check for inline_data (image response)
              const parts = imgData.choices?.[0]?.message?.parts;
              if (parts) {
                for (const part of parts) {
                  if (part.inline_data?.data) {
                    // Upload base64 image to storage
                    const imageBytes = Uint8Array.from(atob(part.inline_data.data), c => c.charCodeAt(0));
                    const imagePath = `social-media/auto/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
                    const { error: uploadError } = await supabaseAdmin.storage
                      .from("estimation-files")
                      .upload(imagePath, imageBytes, { contentType: "image/png" });
                    
                    if (!uploadError) {
                      const { data: urlData } = supabaseAdmin.storage
                        .from("estimation-files")
                        .getPublicUrl(imagePath);
                      imageUrl = urlData.publicUrl;
                    }
                    break;
                  }
                }
              }
            }
          }
        } catch (imgErr) {
          console.error("Image generation failed (non-critical):", imgErr);
          // Continue without image - it's non-critical
        }
      }

      // Insert post into database
      const { data: insertedPost, error: insertError } = await supabaseAdmin
        .from("social_posts")
        .insert({
          user_id: userId,
          platform: post.platform,
          title: post.title || "Untitled",
          content: post.content || "",
          hashtags: post.hashtags || [],
          image_url: imageUrl,
          status: "draft",
          scheduled_date: postDate,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to insert post:", insertError);
        continue;
      }

      createdPosts.push({
        ...insertedPost,
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
