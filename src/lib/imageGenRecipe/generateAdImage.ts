/**
 * generateAdImage — self-contained "REBAR.SHOP look" image generator.
 *
 * Drop this file into any project (Deno / Node / Lovable Edge Function).
 * Only dependency: global `fetch` (Deno, Node ≥18, browsers).
 *
 * NEVER call from the browser — `lovableApiKey` must stay server-side.
 *
 * See docs/image-generation-recipe.md for the full theory.
 */

export interface BrandContext {
  business_name?: string;
  description?: string;
  value_prop?: string;
  tagline?: string;
}

export interface GenerateAdImageInput {
  /** Free-form user prompt, e.g. "wire mesh for foundation slab". */
  prompt: string;
  /** Brand metadata baked into the ad copy. */
  brandContext?: BrandContext;
  /** Public URL of the brand logo (rendered prominently into the image). */
  logoUrl?: string;
  /** Output canvas hint — the model also gets a hard text constraint. */
  aspectRatio?: "1:1" | "9:16" | "16:9";
  /** Industry-specific style rotation; defaults to the rebar list. */
  visualStyles?: string[];
  /** Extra real product photos (max 3 used) shown to the model as references. */
  resourceImages?: string[];
  /** Lovable AI Gateway key — server-side secret. */
  lovableApiKey: string;
  /** Optional Pexels key — without it the result is noticeably less photoreal. */
  pexelsApiKey?: string;
  /** Override model. Default: google/gemini-3-pro-image-preview. */
  model?: string;
}

export interface GenerateAdImageResult {
  /** Either an https URL or a `data:image/...;base64,...` URL. */
  imageUrl: string;
  /** Optional commentary the model returned alongside the image. */
  revisedPrompt?: string | null;
}

const DEFAULT_STYLES = [
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

async function searchPexelsReference(
  query: string,
  apiKey: string | undefined,
): Promise<string | null> {
  if (!apiKey) return null;
  try {
    const params = new URLSearchParams({ query, per_page: "1", page: "1" });
    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.photos?.[0];
    return photo?.src?.large || photo?.src?.medium || photo?.src?.original || null;
  } catch {
    return null;
  }
}

function buildAdPrompt(input: {
  userPrompt: string;
  brandContext?: BrandContext;
  hasReferenceImage: boolean;
  aspectRatio?: string;
  visualStyles: string[];
}): string {
  const { userPrompt, brandContext, hasReferenceImage, aspectRatio, visualStyles } = input;
  const style = visualStyles[Math.floor(Math.random() * visualStyles.length)];
  const brandName = brandContext?.business_name || "BRAND";
  const lines: string[] = [];

  lines.push(`PHOTOREALISTIC ADVERTISING IMAGE — ${brandName}`, "");
  lines.push("ABSOLUTE RULES:");
  lines.push("- ALL images MUST be PHOTOREALISTIC — real-world professional photography style ONLY.");
  lines.push("- Natural lighting, real textures, real materials, real environments.");
  lines.push("- ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract, clip-art.");

  if (aspectRatio === "9:16") {
    lines.push("- MANDATORY CANVAS: 9:16 vertical portrait STORY image, exactly taller-than-wide, equivalent to 1080×1920 pixels. DO NOT create a square 1:1 image. DO NOT create landscape.");
  } else if (aspectRatio === "16:9") {
    lines.push("- Compose the scene as a LANDSCAPE layout — wider than tall, suitable for social media banners.");
  } else {
    lines.push("- Compose the scene as a SQUARE layout — balanced composition, suitable for Instagram feed posts.");
  }

  lines.push(`- Feature ${brandName} products prominently in the scene.`);
  lines.push("- Clean, professional, visually striking — like high-end commercial/industrial photography.", "");

  if (hasReferenceImage) {
    lines.push("Use the provided reference image as visual inspiration for composition and style.");
  }
  lines.push(`Suggested visual style: ${style}`, "");
  lines.push(`User request: ${userPrompt}`, "");

  if (brandContext?.tagline) lines.push(`Brand tagline: "${brandContext.tagline}"`);
  if (brandContext?.value_prop) lines.push(`Value proposition: ${brandContext.value_prop}`);
  if (brandContext?.description) lines.push(`About: ${brandContext.description}`);

  lines.push("");
  lines.push("MANDATORY ADVERTISING BANNER FORMAT — THIS IMAGE IS A COMPANY AD, NOT A PLAIN PHOTO:");
  lines.push(`- The image MUST be designed as a professional ADVERTISING BANNER for ${brandName} — like a billboard, magazine ad, or social media promo card.`);
  lines.push("- It MUST contain BAKED-IN, perfectly legible TEXT directly on the image (rendered by the model, not added later).");
  lines.push("- REQUIRED text elements on the image:");
  lines.push(`    1) A bold HEADLINE / advertising slogan (max 6 words) in the upper third or over a darkened gradient strip — short, catchy, emotional, billboard-style.`);
  if (brandContext?.tagline) lines.push(`       Preferred headline text: "${brandContext.tagline}".`);
  lines.push(`    2) A clear WORDMARK strip with the brand name "${brandName}" in clean bold sans-serif typography.`);
  lines.push(`    3) A short CALL-TO-ACTION line (e.g. "Visit our website", "Order Today").`);
  if (brandContext?.value_prop) lines.push(`       Preferred CTA / value phrase: "${brandContext.value_prop}".`);
  lines.push("- Typography rules: clean bold sans-serif, high contrast over a darkened gradient bar or clean area, professionally kerned, perfectly spelled, NO lorem ipsum, NO gibberish, NO duplicated words.");
  lines.push("- ALL text on the image MUST be in ENGLISH ONLY. ABSOLUTELY NO Persian, Farsi, Arabic, Cyrillic, or non-Latin script anywhere on the image.");
  lines.push("- Do NOT include stock-site watermarks, photographer credits, or random captions.");
  lines.push("- A photorealistic photo with NO baked-in advertising text is a FAILURE — the output MUST look like a finished company ad banner.");
  lines.push("- If a logo image is provided, render it EXACTLY as-is as a visible part of the ad design — NOT a tiny corner watermark.");

  return lines.join("\n");
}

export async function generateAdImage(
  input: GenerateAdImageInput,
): Promise<GenerateAdImageResult> {
  const {
    prompt,
    brandContext,
    logoUrl,
    aspectRatio = "1:1",
    visualStyles = DEFAULT_STYLES,
    resourceImages = [],
    lovableApiKey,
    pexelsApiKey,
    model = "google/gemini-3-pro-image-preview",
  } = input;

  if (!prompt?.trim()) throw new Error("prompt is required");
  if (!lovableApiKey) throw new Error("lovableApiKey is required (server-side secret)");

  // Layer 1 — Pexels reference
  const pexelsUrl = await searchPexelsReference(prompt, pexelsApiKey);

  // Layer 2 — structured prompt
  let adPrompt = buildAdPrompt({
    userPrompt: prompt,
    brandContext,
    hasReferenceImage: !!pexelsUrl,
    aspectRatio,
    visualStyles,
  });
  if (aspectRatio === "9:16") {
    adPrompt =
      `ABSOLUTE FIRST INSTRUCTION — OUTPUT CANVAS MUST BE 9:16 STORY PORTRAIT: Generate a vertical image with width:height ratio exactly 9:16, equivalent to 1080×1920 pixels. The final image must be much taller than wide. SQUARE 1:1 OUTPUT IS FORBIDDEN. LANDSCAPE OUTPUT IS FORBIDDEN.\n\n` +
      adPrompt;
  }

  // Layer 3 — multi-modal content
  const contentParts: any[] = [{ type: "text", text: adPrompt }];
  if (pexelsUrl) contentParts.push({ type: "image_url", image_url: { url: pexelsUrl } });
  if (logoUrl) {
    contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
    contentParts.push({
      type: "text",
      text: "Render this company logo prominently and clearly in the image — make it a visible, professional part of the design. Preserve its exact colors, shape, and design. Do NOT shrink it to a tiny corner watermark.",
    });
  }
  for (const img of resourceImages.slice(0, 3)) {
    contentParts.push({ type: "image_url", image_url: { url: img } });
  }
  if (resourceImages.length > 0) {
    contentParts.push({
      type: "text",
      text: "The above resource images show real products and brand assets — use them as visual references for the generated image. Match the real product appearance.",
    });
  }

  // Call Lovable AI Gateway with retry on 429
  let resp: Response | null = null;
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
      }),
    });
    if (resp.status !== 429 || attempt === maxAttempts - 1) break;
    const wait = Math.min(3000 * Math.pow(2, attempt), 20000);
    await new Promise((r) => setTimeout(r, wait));
  }

  if (!resp!.ok) {
    const errText = await resp!.text().catch(() => "");
    if (resp!.status === 429) throw new Error("Rate limit exceeded — retries exhausted.");
    if (resp!.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`Image generation failed (${resp!.status}): ${errText.slice(0, 200)}`);
  }

  const data: any = await resp!.json();

  // Layer 4 — extract image with fallback
  let imageUrl: string | null =
    data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;

  if (!imageUrl) {
    const content = data.choices?.[0]?.message?.content ?? "";
    const m =
      typeof content === "string" &&
      content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
    if (m) imageUrl = m[0];
  }

  if (!imageUrl) {
    throw new Error("No image returned by the model — try a different prompt.");
  }

  return {
    imageUrl,
    revisedPrompt: data.choices?.[0]?.message?.content ?? null,
  };
}
