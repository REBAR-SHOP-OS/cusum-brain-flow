import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

/** Search Pexels for a reference photo matching the prompt keywords */
async function searchPexelsReference(query: string): Promise<string | null> {
  const apiKey = Deno.env.get("PEXELS_API_KEY");
  if (!apiKey) {
    console.log("PEXELS_API_KEY not configured, skipping reference image");
    return null;
  }

  try {
    const params = new URLSearchParams({ query, per_page: "1", page: "1" });
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      console.error("Pexels search failed:", res.status);
      return null;
    }

    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    // Use medium size for reference — good quality, reasonable size
    return photo.src?.large || photo.src?.medium || photo.src?.original || null;
  } catch (err) {
    console.error("Pexels search error:", err);
    return null;
  }
}

/** Build an advertising-optimized prompt incorporating brand context */
function buildAdPrompt(
  userPrompt: string,
  brandContext?: { business_name?: string; description?: string; value_prop?: string; tagline?: string },
  hasReferenceImage?: boolean
): string {
  const parts: string[] = [];

  if (hasReferenceImage) {
    parts.push("Using the reference image as visual inspiration and style guide, create a new professional advertising image.");
  } else {
    parts.push("Create a professional, high-quality advertising image.");
  }

  if (brandContext?.business_name) {
    parts.push(`This is for the brand "${brandContext.business_name}".`);
  }
  if (brandContext?.tagline) {
    parts.push(`Brand tagline: "${brandContext.tagline}".`);
  }
  if (brandContext?.value_prop) {
    parts.push(`Key value proposition: ${brandContext.value_prop}.`);
  }
  if (brandContext?.description) {
    parts.push(`About the business: ${brandContext.description}.`);
  }

  parts.push(`User request: ${userPrompt}`);
  parts.push("The image must be visually striking, suitable for social media advertising, with strong composition and professional lighting. Do NOT include any text or watermarks in the image.");

  return parts.join("\n");
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

    const { prompt, model, brandContext } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "A text prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedModel = model || "google/gemini-3-pro-image-preview";

    console.log("Generating image with model:", selectedModel, "prompt:", prompt.slice(0, 80));

    // ── Lovable AI (Gemini image models) ──
    if (selectedModel.startsWith("google/gemini")) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Search Pexels for reference image
      const pexelsUrl = await searchPexelsReference(prompt);
      console.log("Pexels reference:", pexelsUrl ? "found" : "none");

      // Step 2: Build advertising-optimized prompt
      const adPrompt = buildAdPrompt(prompt, brandContext, !!pexelsUrl);

      // Step 3: Build message content (multi-modal if reference exists)
      let messageContent: any;
      if (pexelsUrl) {
        messageContent = [
          { type: "text", text: adPrompt },
          { type: "image_url", image_url: { url: pexelsUrl } },
        ];
      } else {
        messageContent = adPrompt;
      }

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: messageContent }],
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Lovable AI image error:", resp.status, errText);

        if (resp.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (resp.status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: `Image generation failed (${resp.status})` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await resp.json();
      const message = data.choices?.[0]?.message;
      const imageUrl = message?.images?.[0]?.image_url?.url || null;
      const revisedPrompt = message?.content || null;

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: "No image was generated by the AI model" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ imageUrl, revisedPrompt, pexelsInspired: !!pexelsUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fallback: OpenAI models ──
    const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
    if (!GPT_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GPT_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel === "gpt-image-1" ? "gpt-image-1" : "dall-e-3",
        prompt,
        size: "1024x1024",
        quality: "high",
        n: 1,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenAI image error:", resp.status, errText);
      return new Response(
        JSON.stringify({ error: `Image generation failed (${resp.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const imageData = data.data?.[0];
    const imageUrl = imageData?.url || (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);

    return new Response(
      JSON.stringify({ imageUrl, revisedPrompt: imageData?.revised_prompt || null, pexelsInspired: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
