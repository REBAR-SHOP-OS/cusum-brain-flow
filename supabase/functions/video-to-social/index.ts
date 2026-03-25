import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { videoUrl, platform, aspectRatio } = await req.json();
    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "videoUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Platform-specific instructions
    const platformGuide: Record<string, string> = {
      instagram: "Instagram: short, punchy, use emojis, max 2200 chars. Include 20-30 relevant hashtags in a separate block.",
      facebook: "Facebook: conversational, storytelling, 1-3 hashtags max. Include a call-to-action.",
      linkedin: "LinkedIn: professional, industry insights, 3-5 hashtags. Use line breaks for readability.",
      tiktok: "TikTok: trendy, Gen-Z friendly, 3-5 viral hashtags. Keep it short and catchy.",
      twitter: "X/Twitter: under 280 chars, witty, 2-3 hashtags max.",
      youtube: "YouTube: descriptive, SEO-optimized title and description with timestamps.",
    };

    const platformInstruction = platformGuide[platform] || platformGuide.instagram;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a social media expert. Generate a complete social post for a video. 
            
RULES:
1. Write an engaging caption optimized for the target platform
2. Generate relevant hashtags
3. Suggest the best posting time
4. Keep the tone professional but engaging
5. For construction/industrial content, use industry-relevant hashtags

RESPOND WITH ONLY a JSON object:
{
  "caption": "The full caption text",
  "hashtags": ["#tag1", "#tag2", ...],
  "suggestedTime": "HH:MM",
  "title": "Short title for the post"
}`
          },
          {
            role: "user",
            content: `Generate a social post for this video.\n\nPlatform: ${platform || "instagram"}\nAspect ratio: ${aspectRatio || "16:9"}\n\n${platformInstruction}`
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Caption generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        caption: content.trim(),
        hashtags: [],
        suggestedTime: "10:00",
        title: "Video Post",
      };
    }

    return new Response(
      JSON.stringify({
        caption: parsed.caption,
        hashtags: parsed.hashtags,
        suggestedTime: parsed.suggestedTime,
        title: parsed.title,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("video-to-social error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
