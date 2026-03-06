import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // 2. Generate new caption + image prompt via Gemini Flash
    const captionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a social media content creator. Given a post's current info, generate completely NEW and DIFFERENT content.
Return JSON with these fields:
- title: short catchy title (max 10 words)
- content: engaging caption for ${post.platform} (2-4 sentences)
- hashtags: array of 5-8 relevant hashtags (with # prefix)
- image_prompt: detailed prompt to generate a new social media image (describe scene, style, colors, mood)

The new content must be different from the original but related to the same business/topic.`,
          },
          {
            role: "user",
            content: `Current post:\nTitle: ${post.title}\nContent: ${post.content}\nHashtags: ${(post.hashtags || []).join(" ")}\nPlatform: ${post.platform}\n\nGenerate completely new content and an image prompt.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "regenerate_post",
              description: "Return new post content and image generation prompt",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  content: { type: "string" },
                  hashtags: { type: "array", items: { type: "string" } },
                  image_prompt: { type: "string" },
                },
                required: ["title", "content", "hashtags", "image_prompt"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "regenerate_post" } },
      }),
    });

    if (!captionRes.ok) {
      const errText = await captionRes.text();
      console.error("Caption AI error:", captionRes.status, errText);
      throw new Error(`Caption generation failed (${captionRes.status})`);
    }

    const captionData = await captionRes.json();
    const toolCall = captionData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in caption response");

    const newContent = JSON.parse(toolCall.function.arguments);
    console.log("Generated content:", JSON.stringify(newContent));

    // 3. Generate new image via Gemini image model
    const imageRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Create a professional, eye-catching social media image: ${newContent.image_prompt}. Make it vibrant and suitable for ${post.platform}. Square format, high quality.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!imageRes.ok) {
      const errText = await imageRes.text();
      console.error("Image AI error:", imageRes.status, errText);
      throw new Error(`Image generation failed (${imageRes.status})`);
    }

    const imageData = await imageRes.json();
    const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    let imageUrl = post.image_url; // fallback to existing

    if (base64Image) {
      // 4. Upload to storage
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const fileName = `images/${crypto.randomUUID()}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("social-media-assets")
        .upload(fileName, binaryData, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("social-media-assets")
          .getPublicUrl(fileName);
        imageUrl = publicUrlData.publicUrl;
      }
    }

    // 5. Update post in DB
    const { error: updateErr } = await supabase
      .from("social_posts")
      .update({
        title: newContent.title,
        content: newContent.content,
        hashtags: newContent.hashtags,
        image_url: imageUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post_id);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        title: newContent.title,
        content: newContent.content,
        hashtags: newContent.hashtags,
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
