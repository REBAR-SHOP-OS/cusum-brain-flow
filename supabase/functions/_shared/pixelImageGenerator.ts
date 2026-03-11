/**
 * Shared Pixel image generation pipeline.
 * Used by both the Pixel agent (ai-agent) and the auto-generate-post function
 * to ensure identical image quality, retry logic, logo overlay, and dedup.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Extract image data URL from various AI response formats.
 * Supports: images[], parts[].inline_data, content[].image_url
 */
export function extractImageFromAIResponse(aiData: any): string | null {
  const msg = aiData?.choices?.[0]?.message;
  if (!msg) return null;

  // Format 1: images[].image_url.url (standard Lovable gateway)
  const img = msg.images?.[0]?.image_url?.url;
  if (img) return img;

  // Format 2: parts[].inline_data.data (Gemini native)
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (part.inline_data?.data) {
        const mime = part.inline_data.mime_type || "image/png";
        return `data:${mime};base64,${part.inline_data.data}`;
      }
    }
  }

  // Format 3: content[] array with image_url objects
  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (block.type === "image_url" && block.image_url?.url) {
        return block.image_url.url;
      }
    }
  }

  return null;
}

/**
 * Resolve a stable logo URL for the social agent.
 * Checks social-images/brand/company-logo.png existence.
 */
export async function resolveLogoUrl(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl) return null;
  const logoUrl = `${supabaseUrl}/storage/v1/object/public/social-images/brand/company-logo.png`;

  try {
    const check = await fetch(logoUrl, { method: "HEAD" });
    if (!check.ok) {
      console.warn(`⚠️ Company logo not found (HTTP ${check.status}), proceeding without logo.`);
      return null;
    }
  } catch (err) {
    console.warn("⚠️ Could not verify logo, proceeding without it:", err);
    return null;
  }

  return logoUrl;
}

/**
 * Generates a social media image with retry pipeline and robust parsing.
 * Attempts multiple models and logo configurations before failing.
 */
export async function generatePixelImage(
  prompt: string,
  svcClient: ReturnType<typeof createClient>,
  logoUrl?: string | null,
  options?: { styleIndex?: number | string },
): Promise<{ imageUrl: string | null; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { imageUrl: null, error: "LOVABLE_API_KEY not configured" };
  }

  if (!logoUrl) {
    console.warn("⚠️ Company logo not found. Generating image without logo overlay.");
  }

  const fullPrompt = logoUrl
    ? prompt +
      "\n\nMANDATORY: The attached company logo image MUST be placed EXACTLY as-is in the generated image, " +
      "without ANY modification, distortion, or recreation. Place it in a visible corner as a watermark. " +
      "Do NOT create or draw any other logo — ONLY use the provided logo image. " +
      "Do NOT add text-based watermarks."
    : prompt;

  const attempts: { model: string; useLogo: boolean }[] = [
    { model: "google/gemini-2.5-flash-image", useLogo: true },
    { model: "google/gemini-2.5-flash-image", useLogo: true },
    { model: "google/gemini-3-pro-image-preview", useLogo: true },
  ];

  let lastError = "Unknown error";

  for (const attempt of attempts) {
    try {
      const contentParts: any[] = [{ type: "text", text: fullPrompt }];

      if (attempt.useLogo && logoUrl) {
        contentParts.push({ type: "image_url", image_url: { url: logoUrl } });
        contentParts.push({
          type: "text",
          text: "CRITICAL: The logo image provided above is the ONLY authorized company logo. " +
            "Place it EXACTLY as-is (no redrawing, no text replacement, no modification) in a visible corner of the generated image. " +
            "Do NOT create any other logo or text-based watermark.",
        });
      }

      console.log(`  → Attempt: ${attempt.model}, logo=${attempt.useLogo && !!logoUrl}`);

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: attempt.model,
          messages: [{ role: "user", content: contentParts }],
          modalities: ["image", "text"],
        }),
      });

      if (!aiRes.ok) {
        lastError = `${attempt.model} returned ${aiRes.status}`;
        console.warn(`  ✗ ${lastError}`);
        continue;
      }

      const aiData = await aiRes.json();
      const imageDataUrl = extractImageFromAIResponse(aiData);

      if (!imageDataUrl) {
        lastError = `${attempt.model} returned no parseable image`;
        console.warn(`  ✗ ${lastError}`);
        continue;
      }

      // Upload to social-images bucket
      let imageBytes: Uint8Array;
      if (imageDataUrl.startsWith("data:")) {
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
        imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      } else {
        const imgResp = await fetch(imageDataUrl);
        if (!imgResp.ok) { lastError = "Failed to download generated image"; continue; }
        const buf = await imgResp.arrayBuffer();
        imageBytes = new Uint8Array(buf);
      }

      const styleTag = options?.styleIndex ?? "x";
      const imagePath = `pixel/${Date.now()}-s${styleTag}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error: uploadError } = await svcClient.storage
        .from("social-images")
        .upload(imagePath, imageBytes, { contentType: "image/png", upsert: false });

      if (uploadError) {
        lastError = `Upload failed: ${uploadError.message}`;
        console.warn(`  ✗ ${lastError}`);
        continue;
      }

      const { data: urlData } = svcClient.storage.from("social-images").getPublicUrl(imagePath);
      console.log(`  ✓ Image generated and uploaded: ${urlData.publicUrl}`);
      return { imageUrl: urlData.publicUrl };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn(`  ✗ Attempt error: ${lastError}`);
    }
  }

  return { imageUrl: null, error: `All generation attempts failed. Last: ${lastError}` };
}

/**
 * Fetch recent image filenames from social-images/pixel for dedup.
 */
export async function fetchRecentPixelImages(
  svcClient: ReturnType<typeof createClient>,
  limit = 30,
): Promise<string[]> {
  try {
    const { data: recentFiles } = await svcClient.storage
      .from("social-images")
      .list("pixel", { limit, sortBy: { column: "created_at", order: "desc" } });
    return recentFiles ? recentFiles.map((f: any) => f.name) : [];
  } catch (e) {
    console.warn("Could not fetch recent images for dedup:", e);
    return [];
  }
}

/** The 12 visual styles used by Pixel agent */
export const PIXEL_VISUAL_STYLES = [
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

/**
 * Select a visual style index avoiding recently used ones.
 */
export function selectVisualStyle(
  recentImageNames: string[],
  styles: string[] = PIXEL_VISUAL_STYLES,
): { style: string; index: number } {
  const usedIndices = new Set<number>();
  for (const name of recentImageNames) {
    const match = name.match(/-s(\d+)-/);
    if (match) usedIndices.add(parseInt(match[1]));
  }
  const available = styles
    .map((s, idx) => ({ style: s, idx }))
    .filter(({ idx }) => !usedIndices.has(idx));
  const pool = available.length > 0 ? available : styles.map((s, idx) => ({ style: s, idx }));
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return { style: selected.style, index: selected.idx };
}

/**
 * Build a full Pixel-quality image prompt with all mandatory rules.
 */
export function buildPixelImagePrompt(opts: {
  product: string;
  theme: string;
  imageText: string;
  selectedStyle: string;
  dedupHint?: string;
  forbiddenHint?: string;
  sessionSeed?: string;
}): string {
  return `MANDATORY REALISM RULE: ALL images MUST be PHOTOREALISTIC — real-world photography style ONLY. ` +
    `ABSOLUTELY FORBIDDEN: CGI, 3D renders, digital illustrations, cartoons, fantasy, surreal, abstract art, AI-looking art, stock photo feel. ` +
    `Every image MUST look like it was taken by a professional photographer with a real camera at a real location.\n\n` +
    `VISUAL STYLE: ${opts.selectedStyle}. ` +
    `PRODUCT FOCUS: ${opts.product} for REBAR.SHOP. THEME: ${opts.theme}. ` +
    `MANDATORY: Write this exact advertising text prominently on the image in a clean, bold, readable font: "${opts.imageText}"` +
    (opts.dedupHint || "") +
    (opts.forbiddenHint || "") +
    (opts.sessionSeed ? ` — unique session seed: ${opts.sessionSeed}` : "") +
    `\n\nMANDATORY VISUAL DIVERSITY RULES:\n` +
    `- Use the specified visual style EXACTLY as described above\n` +
    `- FORBIDDEN: Do not repeat any composition, camera angle, color palette, or scene layout from recent images\n` +
    `- Each image must feel like it belongs to a completely different photo series\n` +
    `- Ultra high resolution, PHOTOREALISTIC ONLY, 1:1 square aspect ratio, perfect for Instagram\n` +
    `- Must look like a REAL photograph — natural imperfections, real lighting, actual textures`;
}
