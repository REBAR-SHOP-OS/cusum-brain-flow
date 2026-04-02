import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_HOSTS = (Deno.env.get("GLASSES_ALLOWED_IMAGE_HOSTS") || "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

function isPrivateOrForbiddenHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254"
  ) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map((n) => Number(n));
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
  }
  return false;
}

function isAllowedImageUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    if (isPrivateOrForbiddenHost(u.hostname)) return false;
    if (ALLOWED_IMAGE_HOSTS.length === 0) return true;
    const host = u.hostname.toLowerCase();
    return ALLOWED_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

Deno.serve((req) =>
  handleRequest(req, async ({ body, userId, serviceClient }) => {
    // Dual auth: accept webhook key OR JWT (userId from wrapper)
    const webhookKey = req.headers.get("x-webhook-key");
    const expectedKey = Deno.env.get("GLASSES_WEBHOOK_KEY");

    const isWebhook = webhookKey && expectedKey && webhookKey === expectedKey;
    if (!isWebhook && !userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, imageUrl, prompt } = body;
    if (!imageBase64 && !imageUrl) {
      return new Response(JSON.stringify({ error: "imageBase64 or imageUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imageData: string;
    let mimeType = "image/jpeg";

    if (imageBase64) {
      imageData = imageBase64;
      if (imageBase64.startsWith("/9j/")) mimeType = "image/jpeg";
      else if (imageBase64.startsWith("iVBOR")) mimeType = "image/png";
      const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        return new Response(JSON.stringify({ error: "Image is too large" }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      if (!isAllowedImageUrl(imageUrl)) {
        return new Response(JSON.stringify({ error: "imageUrl is not allowed" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const imgRes = await fetch(imageUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
      const contentType = (imgRes.headers.get("content-type") || "").toLowerCase();
      if (!contentType.startsWith("image/")) {
        return new Response(JSON.stringify({ error: "imageUrl must return an image content-type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contentLen = Number(imgRes.headers.get("content-length") || "0");
      if (contentLen && contentLen > MAX_IMAGE_BYTES) {
        return new Response(JSON.stringify({ error: "Remote image is too large" }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const imgBuffer = await imgRes.arrayBuffer();
      if (imgBuffer.byteLength > MAX_IMAGE_BYTES) {
        return new Response(JSON.stringify({ error: "Remote image exceeds size limit" }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      imageData = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
      mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    }

    const systemPrompt = `You are Vizzy, the CEO's AI assistant for a rebar fabrication shop (CUSUM/rebar.shop).
This photo was captured from Ray-Ban Meta smart glasses on the shop floor.
Analyze what you see and provide:
- Any machine errors, damage, or safety issues
- Rebar tags, labels, or markings visible
- Production quality issues (bent angles, cut lengths, surface defects)
- Equipment status indicators
- Worker safety compliance (PPE, etc.)
Be specific and actionable. If you see a problem, suggest what to do.
If the user included a specific question, answer it directly.`;

    const userPrompt = prompt || "What do you see in this shop floor photo from my smart glasses? Any issues?";

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "vizzy",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageData}` } },
          ],
        },
      ],
      maxTokens: 1024,
      temperature: 0.3,
    });

    const analysis = result.content || "Could not analyze image.";

    let storedImageUrl = imageUrl || null;
    if (imageBase64 && !imageUrl) {
      const fileName = `glasses/${Date.now()}.jpg`;
      const bytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
      const { error: uploadErr } = await serviceClient.storage
        .from("clearance-photos")
        .upload(fileName, bytes, { contentType: mimeType });

      if (!uploadErr) {
        const { data: urlData } = await serviceClient.storage
          .from("clearance-photos")
          .getPublicUrl(fileName);
        storedImageUrl = urlData?.publicUrl || null;
      }
    }

    const { error: dbErr } = await serviceClient.from("glasses_captures").insert({
      image_url: storedImageUrl, analysis,
      source: userId ? "app" : "glasses",
      prompt: prompt || null,
      metadata: { mimeType, hasBase64: !!imageBase64, hasUrl: !!imageUrl, userId },
    });
    if (dbErr) console.error("Failed to store capture:", dbErr);

    return { analysis, stored: !dbErr };
  }, { functionName: "vizzy-glasses-webhook", authMode: "optional", requireCompany: false, wrapResult: false })
);
