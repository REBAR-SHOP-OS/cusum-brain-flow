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

/** 12 diverse visual styles the Pixel Agent rotates through */
const VISUAL_STYLES = [
  "Construction site with workers using rebar products, golden hour lighting",
  "Warehouse product display — neat stacks of rebar stirrups and ties on metal shelving",
  "Macro close-up of rebar stirrups showing texture, sharp focus, bokeh background",
  "Drone aerial view of a construction project with rebar grids being placed",
  "Urban infrastructure — bridges, overpasses, or high-rises with visible rebar framework",
  "Before-and-after showing raw rebar vs finished reinforced concrete",
  "Industrial workshop — bending machine shaping rebar with sparks, dramatic lighting",
  "Clean studio product shot — rebar accessories arranged on concrete surface",
  "Delivery truck loaded with bundled rebar arriving at a construction site",
  "Engineer inspecting rebar installation on-site with blueprints in hand",
  "Split composition — steel rebar on left, finished structure on right",
  "Rain-soaked construction site with glistening rebar grids, moody atmosphere",
];

/** Build a Pixel-Agent-style photorealistic prompt */
function buildAdPrompt(
  userPrompt: string,
  brandContext?: { business_name?: string; description?: string; value_prop?: string; tagline?: string },
  hasReferenceImage?: boolean,
  aspectRatio?: string
): string {
  const style = VISUAL_STYLES[Math.floor(Math.random() * VISUAL_STYLES.length)];
  const brandName = brandContext?.business_name || "REBAR.SHOP";

  const parts: string[] = [];

  parts.push(`PHOTOREALISTIC ADVERTISING IMAGE — ${brandName}`);
  parts.push("");
  parts.push("ABSOLUTE RULES:");
  parts.push("- ALL images MUST be PHOTOREALISTIC — real-world professional photography style ONLY.");
  parts.push("- Natural lighting, real textures, real materials, real environments.");
  parts.push("- ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract, clip-art.");

  if (aspectRatio === "9:16") {
    parts.push("- The image MUST be VERTICAL (9:16 portrait aspect ratio), suitable for Instagram/Facebook Stories.");
  } else {
    parts.push("- The image MUST be perfectly SQUARE (1:1 aspect ratio), suitable for Instagram feed posts.");
  }

  parts.push(`- Feature ${brandName} products (rebar stirrups, ties, cut & bent rebar, accessories) prominently in the scene.`);
  parts.push("- Clean, professional, visually striking — like high-end commercial/industrial photography.");
  parts.push("");

  if (hasReferenceImage) {
    parts.push("Use the provided reference image as visual inspiration for composition and style.");
  }

  parts.push(`Suggested visual style: ${style}`);
  parts.push("");
  parts.push(`User request: ${userPrompt}`);
  parts.push("");

  if (brandContext?.tagline) parts.push(`Brand tagline: "${brandContext.tagline}"`);
  if (brandContext?.value_prop) parts.push(`Value proposition: ${brandContext.value_prop}`);
  if (brandContext?.description) parts.push(`About: ${brandContext.description}`);

  parts.push("");
  parts.push("TEXT & BRANDING INSTRUCTIONS:");
  if (brandContext?.business_name) {
    parts.push(`- Include the brand name "${brandContext.business_name}" as professional typography text on the image.`);
  }
  if (brandContext?.tagline) {
    parts.push(`- Include the advertising slogan: "${brandContext.tagline}" — render it as stylish, readable text overlay.`);
  }
  if (brandContext?.value_prop) {
    parts.push(`- Optionally include a short call-to-action or value phrase: "${brandContext.value_prop}".`);
  }
  parts.push("- Place text with clean, bold, professional typography — suitable for social media ads.");
  parts.push("- Text should be legible, well-contrasted against the background, and positioned in the lower third or a clean area.");
  parts.push("- Do NOT include watermarks from stock sites.");
  parts.push("");
  parts.push("MANDATORY BRANDING RULE:");
  parts.push("- The final image MUST contain: 1) The company logo rendered clearly and prominently, 2) At least one line of advertising text (brand name, tagline, or CTA).");
  parts.push("- If a logo image is provided, render it as a visible, professional part of the design — NOT a tiny watermark.");

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

    const { prompt, model, brandContext, logoUrl, aspectRatio } = await req.json();

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
      const adPrompt = buildAdPrompt(prompt, brandContext, !!pexelsUrl, aspectRatio);

      // Step 3: Build message content (multi-modal with reference + logo)
      const contentParts: any[] = [{ type: "text", text: adPrompt }];
      if (pexelsUrl) {
        contentParts.push({ type: "image_url", image_url: { url: pexelsUrl } });
      }
      if (logoUrl) {
        contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
        contentParts.push({ type: "text", text: "Incorporate this company logo naturally as a branded watermark in the corner of the image — preserve its exact colors, shape, and design." });
      }
      const messageContent = contentParts.length === 1 ? adPrompt : contentParts;

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
