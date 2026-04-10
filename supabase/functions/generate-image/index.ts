import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { cropToAspectRatio } from "../_shared/imageResize.ts";

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

  // Soft composition hint — final dimensions enforced by server-side crop/resize
  if (aspectRatio === "9:16") {
    parts.push("- Compose the scene as a VERTICAL/PORTRAIT layout — taller than wide, suitable for Instagram/Facebook Stories.");
  } else if (aspectRatio === "16:9") {
    parts.push("- Compose the scene as a LANDSCAPE layout — wider than tall, suitable for social media banners.");
  } else {
    parts.push("- Compose the scene as a SQUARE layout — balanced composition, suitable for Instagram feed posts.");
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
  parts.push("- ALL text on the image MUST be in ENGLISH ONLY. ABSOLUTELY NO Persian, Farsi, Arabic, or any non-Latin script text anywhere in the image.");
  parts.push("");
  parts.push("MANDATORY BRANDING RULE:");
  parts.push("- The final image MUST contain: 1) The company logo rendered clearly and prominently, 2) At least one line of advertising text (brand name, tagline, or CTA).");
  parts.push("- If a logo image is provided, render it as a visible, professional part of the design — NOT a tiny watermark.");

  return parts.join("\n");
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, body }) => {
    const { prompt, model, brandContext, logoUrl, aspectRatio, editImage, originalImage, referenceImage } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "A text prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedModel = model || "google/gemini-3-pro-image-preview";

    console.log("Generating image with model:", selectedModel, "prompt:", prompt.slice(0, 80), "editMode:", !!editImage);

    // ── Fetch Pixel Brain context (knowledge table) ──
    let brainInstructions = "";
    let brainResourceImages: string[] = [];
    try {
      const sbUrl = Deno.env.get("SUPABASE_URL")!;
      const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sbAdmin = createClient(sbUrl, sbKey);
      const { data: knowledgeRows } = await sbAdmin
        .from("knowledge")
        .select("content, metadata")
        .or("metadata->>agent.eq.social,metadata->>agent.eq.pixel");

      if (knowledgeRows?.length) {
        const instructions: string[] = [];
        const images: string[] = [];
        for (const row of knowledgeRows) {
          const meta = (typeof row.metadata === "object" && row.metadata) || {};
          if ((meta as any).type === "custom_instructions" && row.content) {
            instructions.push(row.content);
          }
          if ((meta as any).resource_images && Array.isArray((meta as any).resource_images)) {
            images.push(...(meta as any).resource_images);
          }
          if ((meta as any).type === "resource_image" && row.content) {
            images.push(row.content);
          }
        }
        brainInstructions = instructions.join("\n");
        brainResourceImages = images.filter(Boolean);
        console.log(`Pixel Brain context: ${instructions.length} instruction(s), ${brainResourceImages.length} resource image(s)`);
      }
    } catch (e) {
      console.warn("Failed to fetch Pixel Brain context:", e);
    }

    // ── Lovable AI (Gemini image models) ──
    if (selectedModel.startsWith("google/gemini")) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── EDIT MODE: inpainting via annotated image ──
      if (editImage) {
        const hasRef = referenceImage && typeof referenceImage === "string";
        const hasOriginal = originalImage && typeof originalImage === "string";
        
        let editPrompt: string;
        if (hasRef) {
          editPrompt = `You are a professional image editor. You will receive images in this order:
1. An ANNOTATED image with RED marks/highlights showing the areas to edit
2. The CLEAN ORIGINAL image without any marks (use this as the pristine base)
3. A REFERENCE image provided by the user

Instructions:
- The red marks on the first image are ANNOTATIONS ONLY — they indicate WHERE to apply changes. They are NOT part of the image.
- Apply this edit instruction to the red-marked areas: "${prompt}"
- You MUST incorporate/place the reference image (image 3) into the red-marked area as instructed. Reproduce it as faithfully as possible.
- Use the clean original (image 2) as the base. Keep everything outside the red-marked regions EXACTLY the same.
- The final output MUST contain absolutely NO red marks, highlights, or annotations. Output a clean, natural-looking image.`;
        } else {
          editPrompt = `You are a professional image editor. You will receive images in this order:
1. An ANNOTATED image with RED marks/highlights showing the areas to edit
2. The CLEAN ORIGINAL image without any marks (use this as the pristine base)

Instructions:
- The red marks on the first image are ANNOTATIONS ONLY — they indicate WHERE to apply changes. They are NOT part of the image.
- Apply this edit instruction to the red-marked areas: "${prompt}"
- Use the clean original (image 2) as the base. Keep everything outside the red-marked regions EXACTLY the same — same composition, colors, lighting, and details.
- The final output MUST contain absolutely NO red marks, highlights, or annotations. Output a clean, natural-looking image.`;
        }

        const contentParts: any[] = [
          { type: "text", text: editPrompt },
          { type: "image_url", image_url: { url: editImage } },
        ];
        // Add clean original image as second image
        if (hasOriginal) {
          contentParts.push({ type: "image_url", image_url: { url: originalImage } });
        }
        if (hasRef) {
          contentParts.push({ type: "image_url", image_url: { url: referenceImage } });
        }

        // Retry loop for rate limits (5 attempts with exponential backoff)
        let resp: Response | null = null;
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [{
                role: "user",
                content: contentParts,
              }],
              modalities: ["image", "text"],
            }),
          });

          if (resp.status !== 429 || attempt === maxAttempts - 1) break;
          const wait = Math.min(3000 * Math.pow(2, attempt), 20000);
          console.log(`Rate limited on edit attempt ${attempt + 1}/${maxAttempts}, waiting ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
        }

        if (!resp!.ok) {
          const errText = await resp!.text();
          console.error("AI edit error:", resp!.status, errText);
          const status = resp!.status === 429 ? 429 : resp!.status === 402 ? 402 : 502;
          return new Response(
            JSON.stringify({ error: status === 429 ? "Rate limit exceeded — retries exhausted." : status === 402 ? "AI credits exhausted." : `Edit failed (${resp!.status})` }),
            { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let data: any;
        try {
          data = await resp!.json();
        } catch (parseErr) {
          console.error("Failed to parse AI edit response as JSON:", parseErr);
          return new Response(
            JSON.stringify({ error: "AI returned an invalid response. Please try again with a simpler edit." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        let imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;

        // Fallback: check if image is embedded as base64 in content
        if (!imageUrl) {
          const content = data.choices?.[0]?.message?.content || "";
          const b64Match = typeof content === "string" && content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
          if (b64Match) {
            imageUrl = b64Match[0];
            console.log("Edit: extracted base64 image from content text");
          }
        }

        if (!imageUrl) {
          console.error("No edited image in response. Keys:", JSON.stringify(Object.keys(data)), "message keys:", JSON.stringify(Object.keys(data.choices?.[0]?.message || {})), "content preview:", JSON.stringify(data.choices?.[0]?.message?.content || "").slice(0, 300));
          return new Response(
            JSON.stringify({ error: "No edited image returned. The AI model may have declined the edit request. Try a different prompt." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ imageUrl, revisedPrompt: data.choices?.[0]?.message?.content || null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── GENERATE MODE (existing flow) ──
      // Step 1: Search Pexels for reference image
      const pexelsUrl = await searchPexelsReference(prompt);
      console.log("Pexels reference:", pexelsUrl ? "found" : "none");

      // Step 2: Build advertising-optimized prompt with Pixel Brain context
      let adPrompt = buildAdPrompt(prompt, brandContext, !!pexelsUrl, aspectRatio);
      if (brainInstructions) {
        adPrompt = `PRIORITY BRAND INSTRUCTIONS (from Pixel Brain):\n${brainInstructions}\n\n${adPrompt}`;
      }

      // Step 3: Build message content (multi-modal with reference + logo + brain resources)
      const contentParts: any[] = [{ type: "text", text: adPrompt }];
      if (pexelsUrl) {
        contentParts.push({ type: "image_url", image_url: { url: pexelsUrl } });
      }
      if (logoUrl) {
        contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
        contentParts.push({ type: "text", text: "Render this company logo prominently and clearly in the image — make it a visible, professional part of the design. Preserve its exact colors, shape, and design. Do NOT shrink it to a tiny corner watermark." });
      }
      // Add Pixel Brain resource images as visual references
      for (const resImg of brainResourceImages.slice(0, 3)) {
        contentParts.push({ type: "image_url", image_url: { url: resImg } });
      }
      if (brainResourceImages.length > 0) {
        contentParts.push({ type: "text", text: "The above resource images show real products and brand assets — use them as visual references for the generated image. Match the real product appearance." });
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

      let data: any;
      try {
        data = await resp.json();
      } catch (parseErr) {
        console.error("Failed to parse AI generate response as JSON:", parseErr);
        return new Response(
          JSON.stringify({ error: "AI returned an invalid response. Please try again." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const message = data.choices?.[0]?.message;
      let imageUrl = message?.images?.[0]?.image_url?.url || null;
      const revisedPrompt = message?.content || null;

      if (!imageUrl) {
        return new Response(
          JSON.stringify({ error: "No image was generated by the AI model" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Enforce aspect ratio via server-side crop/resize if requested
      if (aspectRatio && aspectRatio !== "1:1" && imageUrl.startsWith("data:")) {
        try {
          const b64 = imageUrl.replace(/^data:image\/\w+;base64,/, "");
          let imageBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          imageBytes = await cropToAspectRatio(imageBytes, aspectRatio);
          imageUrl = `data:image/png;base64,${btoa(String.fromCharCode(...imageBytes))}`;
          console.log(`[generate-image] Applied ${aspectRatio} crop to output`);
        } catch (cropErr) {
          console.warn("[generate-image] Crop failed, returning uncropped:", cropErr);
        }
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
        quality: selectedModel === "gpt-image-1" ? "high" : "hd",
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

    let data: any;
    try {
      data = await resp.json();
    } catch (parseErr) {
      console.error("Failed to parse OpenAI response as JSON:", parseErr);
      return new Response(
        JSON.stringify({ error: "AI returned an invalid response. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const imageData = data.data?.[0];
    const imageUrl = imageData?.url || (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);

    return new Response(
      JSON.stringify({ imageUrl, revisedPrompt: imageData?.revised_prompt || null, pexelsInspired: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "generate-image", requireCompany: false, wrapResult: false })
);
