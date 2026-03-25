import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_BASE = "https://api.openai.com/v1";
const DASHSCOPE_BASE = "https://dashscope-intl.aliyuncs.com/api/v1";

// ─── Provider config ────────────────────────────────────────
const VEO_CLIP_DURATIONS = [4, 6, 8];
const SORA_CLIP_DURATIONS = [4, 8, 12];
const VEO_MAX_CLIP = 8;
const SORA_MAX_CLIP = 12;

function snapDuration(raw: number, valid: number[]): number {
  return valid.reduce((prev, curr) =>
    Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isProviderCapacityError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("billing") ||
    lower.includes("hard limit") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing_hard_limit_reached") ||
    lower.includes("429")
  );
}

// ─── Veo helpers ────────────────────────────────────────────

async function veoGenerate(
  apiKey: string, prompt: string, duration: number,
  firstFrameBase64?: string, firstFrameMimeType?: string,
  lastFrameBase64?: string, lastFrameMimeType?: string,
) {
  const model = "veo-3.1-generate-preview";
  const url = `${GEMINI_BASE}/models/${model}:predictLongRunning`;
  const veoDuration = snapDuration(duration, VEO_CLIP_DURATIONS);

  const instance: Record<string, unknown> = { prompt };

  // First frame image (image-to-video start)
  if (firstFrameBase64) {
    instance.image = {
      inlineData: {
        mimeType: firstFrameMimeType || "image/jpeg",
        data: firstFrameBase64,
      },
    };
  }

  // Last frame image (image-to-video end)
  if (lastFrameBase64) {
    instance.lastFrame = {
      inlineData: {
        mimeType: lastFrameMimeType || "image/jpeg",
        data: lastFrameBase64,
      },
    };
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        sampleCount: 1,
        durationSeconds: veoDuration,
        aspectRatio: "16:9",
        personGeneration: "allow_all",
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Veo submit error:", resp.status, errText);
    let detail = `Veo generation failed (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      const apiMsg = errJson?.error?.message || errJson?.error?.code || errJson?.error;
      if (apiMsg) detail = typeof apiMsg === "string" ? apiMsg : JSON.stringify(apiMsg);
    } catch { /* use default */ }
    throw new Error(detail);
  }

  const data = await resp.json();
  return { jobId: data.name, provider: "veo" };
}

async function veoPoll(apiKey: string, operationName: string) {
  const pollUrl = `${GEMINI_BASE}/${operationName}`;
  const resp = await fetch(pollUrl, {
    headers: { "x-goog-api-key": apiKey },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Veo poll error:", resp.status, errText);
    throw new Error(`Veo polling failed (${resp.status})`);
  }

  const data = await resp.json();

  if (data.done) {
    const videos =
      data.response?.generateVideoResponse?.generatedSamples ||
      data.response?.generatedSamples ||
      data.result?.generateVideoResponse?.generatedSamples ||
      data.result?.generatedSamples ||
      [];
    const videoUri = videos[0]?.video?.uri || null;

    if (videoUri) {
      return { status: "completed", videoUrl: videoUri, needsGeminiAuth: true };
    }

    const error = data.error || data.response?.error;
    if (error) {
      return { status: "failed", error: error.message || "Video generation failed" };
    }

    return { status: "completed", videoUrl: null };
  }

  const metadata = data.metadata || {};
  return { status: "processing", progress: metadata.percentComplete || null };
}

async function veoDownloadBytes(apiKey: string, videoUrl: string): Promise<Uint8Array> {
  const resp = await fetch(videoUrl, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!resp.ok) throw new Error(`Veo download failed (${resp.status})`);
  return new Uint8Array(await resp.arrayBuffer());
}

async function veoDownload(apiKey: string, videoUrl: string) {
  const resp = await fetch(videoUrl, {
    headers: { "x-goog-api-key": apiKey },
  });

  if (!resp.ok) throw new Error(`Veo download failed (${resp.status})`);

  return new Response(resp.body, {
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "video/mp4",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

// ─── Wan (Alibaba DashScope) helpers ────────────────────────

// Wan 2.6 supports 2-15s per clip at 1080P with auto-audio
const WAN_CLIP_DURATIONS = [5, 10, 15];
const WAN_MAX_CLIP = 15;

// Resolution map for wan2.6-t2v (size parameter uses width*height format)
const WAN_SIZE_MAP: Record<string, string> = {
  "16:9": "1920*1080",
  "9:16": "1080*1920",
  "1:1": "1440*1440",
};

async function wanGenerate(
  apiKey: string, prompt: string, duration: number,
  aspectRatio?: string, negativePrompt?: string, audioUrl?: string,
) {
  const wanDuration = Math.max(2, Math.min(15, duration));
  const url = `${DASHSCOPE_BASE}/services/aigc/video-generation/video-synthesis`;
  const size = WAN_SIZE_MAP[aspectRatio || "16:9"] || "1920*1080";

  const params: Record<string, unknown> = {
    size,
    duration: wanDuration,
    prompt_extend: true,
  };
  if (negativePrompt) params.negative_prompt = negativePrompt;
  if (audioUrl) params.audio_url = audioUrl;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: "wan2.6-t2v",
      input: { prompt },
      parameters: params,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Wan submit error:", resp.status, errText);
    let detail = `Wan generation failed (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      const apiMsg = errJson?.message || errJson?.code;
      if (apiMsg) detail = typeof apiMsg === "string" ? apiMsg : JSON.stringify(apiMsg);
    } catch { /* use default */ }
    throw new Error(detail);
  }

  const data = await resp.json();
  const taskId = data?.output?.task_id;
  if (!taskId) throw new Error("Wan did not return a task_id");
  return { jobId: taskId, provider: "wan" };
}

// ─── Wan I2V (Image-to-Video) helper ────────────────────────

async function wanI2vGenerate(
  apiKey: string, prompt: string, imageUrl: string, duration: number,
  aspectRatio?: string, negativePrompt?: string, flash = false,
) {
  const wanDuration = Math.max(2, Math.min(15, duration));
  const url = `${DASHSCOPE_BASE}/services/aigc/video-generation/video-synthesis`;
  const size = WAN_SIZE_MAP[aspectRatio || "16:9"] || "1920*1080";
  const model = flash ? "wan2.6-i2v-flash" : "wan2.6-i2v";

  const params: Record<string, unknown> = {
    size,
    duration: wanDuration,
    prompt_extend: true,
  };
  if (negativePrompt) params.negative_prompt = negativePrompt;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model,
      input: { prompt, img_url: imageUrl },
      parameters: params,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Wan I2V submit error:", resp.status, errText);
    let detail = `Wan I2V generation failed (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      const apiMsg = errJson?.message || errJson?.code;
      if (apiMsg) detail = typeof apiMsg === "string" ? apiMsg : JSON.stringify(apiMsg);
    } catch { /* use default */ }
    throw new Error(detail);
  }

  const data = await resp.json();
  const taskId = data?.output?.task_id;
  if (!taskId) throw new Error("Wan I2V did not return a task_id");
  return { jobId: taskId, provider: "wan" };
}

async function wanPoll(apiKey: string, taskId: string) {
  const resp = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Wan poll error:", resp.status, errText);
    throw new Error(`Wan polling failed (${resp.status})`);
  }

  const data = await resp.json();
  const output = data?.output || {};
  const taskStatus = output.task_status;

  if (taskStatus === "SUCCEEDED") {
    const videoUrl = output.video_url || output.results?.[0]?.url;
    return { status: "completed", videoUrl, needsAuth: false };
  }

  if (taskStatus === "FAILED") {
    return { status: "failed", error: output.message || "Wan generation failed" };
  }

  return { status: "processing", progress: null };
}

async function wanDownloadBytes(videoUrl: string): Promise<Uint8Array> {
  const resp = await fetch(videoUrl);
  if (!resp.ok) throw new Error(`Wan download failed (${resp.status})`);
  return new Uint8Array(await resp.arrayBuffer());
}

async function wanDownload(videoUrl: string) {
  const resp = await fetch(videoUrl);
  if (!resp.ok) throw new Error(`Wan download failed (${resp.status})`);
  return new Response(resp.body, {
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "video/mp4",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

// ─── Sora helpers ───────────────────────────────────────────

async function soraGenerate(apiKey: string, prompt: string, duration: number, model: string) {
  const soraDuration = snapDuration(duration, SORA_CLIP_DURATIONS);

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", model || "sora-2");
  formData.append("size", "1280x720");
  formData.append("seconds", String(soraDuration));

  const resp = await fetch(`${OPENAI_BASE}/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Sora submit error:", resp.status, errText);
    // Parse and surface the actual API error message
    let detail = `Sora generation failed (${resp.status})`;
    try {
      const errJson = JSON.parse(errText);
      const apiMsg = errJson?.error?.message || errJson?.error?.code || errJson?.error;
      if (apiMsg) {
        detail = typeof apiMsg === "string" ? apiMsg : JSON.stringify(apiMsg);
      }
    } catch { /* use default */ }
    throw new Error(detail);
  }

  const data = await resp.json();
  return { jobId: data.id, provider: "sora" };
}

async function soraPoll(apiKey: string, videoId: string) {
  const resp = await fetch(`${OPENAI_BASE}/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Sora poll error:", resp.status, errText);
    throw new Error(`Sora polling failed (${resp.status})`);
  }

  const data = await resp.json();

  if (data.status === "completed") {
    const videoUrl = `${OPENAI_BASE}/videos/${videoId}/content`;
    return { status: "completed", videoUrl, needsAuth: true };
  }

  if (data.status === "failed") {
    return { status: "failed", error: data.error?.message || "Sora generation failed" };
  }

  return { status: "processing", progress: data.progress || null };
}

async function soraDownloadBytes(apiKey: string, videoId: string): Promise<Uint8Array> {
  const resp = await fetch(`${OPENAI_BASE}/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!resp.ok) throw new Error(`Sora download failed (${resp.status})`);
  return new Uint8Array(await resp.arrayBuffer());
}

async function soraDownload(apiKey: string, videoId: string) {
  const resp = await fetch(`${OPENAI_BASE}/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!resp.ok) throw new Error(`Sora download failed (${resp.status})`);

  return new Response(resp.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

// ─── Multi-scene helpers ────────────────────────────────────

async function generateScenePrompts(
  basePrompt: string,
  sceneCount: number,
  clipDuration: number,
): Promise<string[]> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    console.warn("LOVABLE_API_KEY not set, using duplicate prompts for scenes");
    return Array(sceneCount).fill(basePrompt);
  }

  const systemPrompt = `You are a video director. Given a video concept, create exactly ${sceneCount} distinct continuous camera shots that together tell a cohesive visual story. Each shot will be ${clipDuration} seconds of continuous action.

Rules:
- Each scene must be a self-contained visual description
- Scenes should flow naturally from one to the next
- Include camera movement, lighting, and mood details
- Do NOT mention scene numbers, transitions, or editing
- Return ONLY a JSON array of ${sceneCount} strings, nothing else

Example output format:
["A sweeping aerial shot of...", "Close-up of hands..."]`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Video concept: ${basePrompt}` },
      ],
    }),
  });

  if (!resp.ok) {
    console.error("Scene prompt generation failed:", resp.status);
    return Array(sceneCount).fill(basePrompt);
  }

  try {
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    // Extract JSON array from response (may be wrapped in markdown code fences)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const scenes = JSON.parse(jsonMatch[0]);
      if (Array.isArray(scenes) && scenes.length === sceneCount) {
        return scenes.map(String);
      }
    }
  } catch (e) {
    console.error("Failed to parse scene prompts:", e);
  }

  return Array(sceneCount).fill(basePrompt);
}

/** Upload a video buffer to generated-videos bucket, return public URL */
async function uploadToStorage(
  userId: string,
  videoBytes: Uint8Array,
): Promise<string> {
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const fileName = `${userId}/${crypto.randomUUID()}.mp4`;
  const { error } = await serviceClient.storage
    .from("generated-videos")
    .upload(fileName, videoBytes, {
      contentType: "video/mp4",
      upsert: false,
    });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error(`Failed to upload video: ${error.message}`);
  }

  const { data } = serviceClient.storage
    .from("generated-videos")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/** Simple MP4 concatenation: just append bytes. Works when all clips share the same codec/resolution. */
function concatVideoBytes(clips: Uint8Array[]): Uint8Array {
  // For proper concatenation we need to re-mux, but for same-source clips
  // we can use a simpler approach: return the largest clip if concat fails,
  // or try raw byte append for compatible fMP4 streams
  const totalLen = clips.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const clip of clips) {
    result.set(clip, offset);
    offset += clip.length;
  }
  return result;
}

// ─── Main handler ───────────────────────────────────────────

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient, req: rawReq } = ctx;
    const auth = { userId };

    const videoSchema = z.object({
      action: z.enum(["generate", "poll", "download", "generate-multi", "poll-multi", "list-library", "delete-library"]),
      provider: z.enum(["veo", "sora", "wan"]).optional(),
      prompt: z.string().max(5000).optional(),
      jobId: z.string().max(500).optional(),
      jobIds: z.array(z.object({
        id: z.string(),
        provider: z.enum(["veo", "sora", "wan"]),
        sceneIndex: z.number(),
      })).optional(),
      videoUrl: z.string().max(2000).optional(),
      duration: z.number().min(1).max(120).optional(),
      model: z.string().max(50).optional(),
      fileId: z.string().max(500).optional(),
      existingSceneUrls: z.record(z.string(), z.string()).optional(),
      imageUrl: z.string().max(2000).optional(),
      audioUrl: z.string().max(2000).optional(),
      negativePrompt: z.string().max(2000).optional(),
      aspectRatio: z.string().max(10).optional(),
      firstFrameBase64: z.string().optional(),
      firstFrameMimeType: z.string().max(50).optional(),
      lastFrameBase64: z.string().optional(),
      lastFrameMimeType: z.string().max(50).optional(),
    });
    const parsed = videoSchema.safeParse(await rawReq.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { action, provider, prompt, jobId, jobIds, videoUrl, duration, model, fileId, existingSceneUrls: parsedExistingSceneUrls, imageUrl, audioUrl: inputAudioUrl, negativePrompt, aspectRatio, firstFrameBase64, firstFrameMimeType, lastFrameBase64, lastFrameMimeType } = parsed.data;

    const isVeo = provider === "veo";
    const isWan = provider === "wan";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const gptKey = Deno.env.get("GPT_API_KEY");
    const dashscopeKey = Deno.env.get("DASHSCOPE_API_KEY");
    const apiKey = isWan ? dashscopeKey : isVeo ? geminiKey : gptKey;

    // ── Library: list saved videos ──
    if (action === "list-library") {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: files, error } = await serviceClient.storage
        .from("generated-videos")
        .list(auth.userId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const videos = (files || [])
        .filter(f => f.name.endsWith(".mp4"))
        .map(f => {
          const { data } = serviceClient.storage
            .from("generated-videos")
            .getPublicUrl(`${auth.userId}/${f.name}`);
          return {
            id: f.id,
            name: f.name,
            url: data.publicUrl,
            created_at: f.created_at,
            size: f.metadata?.size || 0,
          };
        });

      return new Response(
        JSON.stringify({ videos }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Library: delete a saved video ──
    if (action === "delete-library") {
      if (!fileId) {
        return new Response(
          JSON.stringify({ error: "fileId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const filePath = `${auth.userId}/${fileId}`;
      const { error } = await serviceClient.storage
        .from("generated-videos")
        .remove([filePath]);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKey) {
      const keyName = isWan ? "DASHSCOPE_API_KEY" : isVeo ? "GEMINI_API_KEY" : "GPT_API_KEY";
      return new Response(
        JSON.stringify({ error: `${keyName} is not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate (single clip) ──
    if (action === "generate") {
      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "A text prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let result: { jobId: string; provider: string };
      try {
        if (isWan) {
          // Check if this is an I2V request (image URL provided)
          if (imageUrl) {
            const isFlash = model === "wan2.6-i2v-flash";
            result = await wanI2vGenerate(apiKey, prompt, imageUrl, duration || 8, aspectRatio, negativePrompt, isFlash);
          } else {
            result = await wanGenerate(apiKey, prompt, duration || 8, aspectRatio, negativePrompt, inputAudioUrl);
          }
        } else if (!isVeo) {
          // Sora selected — fallback: Sora → Wan → Veo
          try {
            result = await soraGenerate(apiKey, prompt, duration || 8, (model && model.startsWith("sora")) ? model : "sora-2");
          } catch (e) {
            const message = getErrorMessage(e);
            if (isProviderCapacityError(message) && dashscopeKey) {
              console.warn("Sora capacity reached, falling back to Wan");
              result = await wanGenerate(dashscopeKey, prompt, duration || 8, aspectRatio, negativePrompt, inputAudioUrl);
            } else if (isProviderCapacityError(message) && geminiKey) {
              console.warn("Sora capacity reached, falling back to Veo");
              result = await veoGenerate(geminiKey, prompt, duration || 8, firstFrameBase64, firstFrameMimeType, lastFrameBase64, lastFrameMimeType);
            } else {
              throw e;
            }
          }
        } else {
          // Veo selected — fallback: Veo → Wan → Sora
          try {
            result = await veoGenerate(apiKey, prompt, duration || 8, firstFrameBase64, firstFrameMimeType, lastFrameBase64, lastFrameMimeType);
          } catch (e) {
            const message = getErrorMessage(e);
            if (isProviderCapacityError(message) && dashscopeKey) {
              console.warn("Veo capacity reached, falling back to Wan");
              result = await wanGenerate(dashscopeKey, prompt, duration || 8, aspectRatio, negativePrompt, inputAudioUrl);
            } else if (isProviderCapacityError(message) && gptKey) {
              console.warn("Veo capacity reached, falling back to Sora");
              result = await soraGenerate(gptKey, prompt, duration || 8, "sora-2");
            } else {
              throw e;
            }
          }
        }
      } catch (e) {
        const message = getErrorMessage(e);

        // Slideshow fallback for single clip when both providers exhausted
        if (isProviderCapacityError(message)) {
          const lovableKey = Deno.env.get("LOVABLE_API_KEY");
          if (lovableKey) {
            try {
              const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${lovableKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-3.1-flash-image-preview",
                  messages: [
                    {
                      role: "user",
                      content: `Generate a high-quality, cinematic 16:9 photograph for this video scene. Photorealistic, dramatic lighting, professional composition. Scene: ${prompt}`,
                    },
                  ],
                  modalities: ["image", "text"],
                }),
              });

              if (imgResp.ok) {
                const imgData = await imgResp.json();
                const b64Url = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                if (b64Url) {
                  const serviceClient = createClient(
                    Deno.env.get("SUPABASE_URL")!,
                    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
                  );
                  const base64Data = b64Url.replace(/^data:image\/\w+;base64,/, "");
                  const binaryStr = atob(base64Data);
                  const bytes = new Uint8Array(binaryStr.length);
                  for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

                  const fileName = `${auth.userId}/${crypto.randomUUID()}.png`;
                  await serviceClient.storage
                    .from("generated-videos")
                    .upload(fileName, bytes, { contentType: "image/png", upsert: false });

                  const { data: pubData } = serviceClient.storage
                    .from("generated-videos")
                    .getPublicUrl(fileName);

                  return new Response(
                    JSON.stringify({
                      status: "completed",
                      mode: "slideshow",
                      imageUrls: [pubData.publicUrl],
                      clipDuration: duration || 8,
                      totalScenes: 1,
                      message: "Video providers unavailable — generated motion slideshow instead",
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                }
              }
            } catch (slideshowErr) {
              console.error("Single clip slideshow fallback failed:", slideshowErr);
            }
          }
        }

        return new Response(
          JSON.stringify({
            status: "failed",
            error: message,
            errorCode: isProviderCapacityError(message) ? "provider_capacity_exhausted" : "generation_failed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ ...result, status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate Multi-Scene ──
    if (action === "generate-multi") {
      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "A text prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const requestedDuration = duration || 30;
      const maxClip = isWan ? WAN_MAX_CLIP : isVeo ? VEO_MAX_CLIP : SORA_MAX_CLIP;
      const clipDuration = maxClip;
      const sceneCount = Math.ceil(requestedDuration / clipDuration);

      // Use Lovable AI to generate scene-specific prompts
      const scenePrompts = await generateScenePrompts(
        prompt,
        sceneCount,
        clipDuration,
      );

      // Generate all scenes in parallel
      const jobs: { id: string; provider: string; sceneIndex: number }[] = [];
      const errors: string[] = [];

      await Promise.all(
        scenePrompts.map(async (scenePrompt, i) => {
          // For multi-scene: first frame on scene 0, last frame on final scene
          const isFirstScene = i === 0;
          const isLastScene = i === scenePrompts.length - 1;
          const sceneFirstFrame = isFirstScene ? firstFrameBase64 : undefined;
          const sceneFirstMime = isFirstScene ? firstFrameMimeType : undefined;
          const sceneLastFrame = isLastScene ? lastFrameBase64 : undefined;
          const sceneLastMime = isLastScene ? lastFrameMimeType : undefined;

          try {
            let result: { jobId: string; provider: string };
            if (isWan) {
              result = await wanGenerate(apiKey, scenePrompt, clipDuration, aspectRatio, negativePrompt, inputAudioUrl);
            } else if (!isVeo) {
              // Sora — fallback: Sora → Wan → Veo
              try {
                result = await soraGenerate(apiKey, scenePrompt, clipDuration, (model && model.startsWith("sora")) ? model : "sora-2");
              } catch (e) {
                const message = getErrorMessage(e);
                if (isProviderCapacityError(message) && dashscopeKey) {
                  console.warn(`Sora capacity reached on scene ${i + 1}, falling back to Wan`);
                  result = await wanGenerate(dashscopeKey, scenePrompt, clipDuration, aspectRatio, negativePrompt, inputAudioUrl);
                } else if (isProviderCapacityError(message) && geminiKey) {
                  console.warn(`Sora capacity reached on scene ${i + 1}, falling back to Veo`);
                  result = await veoGenerate(geminiKey, scenePrompt, clipDuration, sceneFirstFrame, sceneFirstMime, sceneLastFrame, sceneLastMime);
                } else {
                  throw e;
                }
              }
            } else {
              // Veo — fallback: Veo → Wan → Sora
              try {
                result = await veoGenerate(apiKey, scenePrompt, clipDuration, sceneFirstFrame, sceneFirstMime, sceneLastFrame, sceneLastMime);
              } catch (e) {
                const message = getErrorMessage(e);
                if (isProviderCapacityError(message) && dashscopeKey) {
                  console.warn(`Veo capacity reached on scene ${i + 1}, falling back to Wan`);
                  result = await wanGenerate(dashscopeKey, scenePrompt, clipDuration, aspectRatio, negativePrompt, inputAudioUrl);
                } else if (isProviderCapacityError(message) && gptKey) {
                  console.warn(`Veo capacity reached on scene ${i + 1}, falling back to Sora`);
                  result = await soraGenerate(gptKey, scenePrompt, clipDuration, "sora-2");
                } else {
                  throw e;
                }
              }
            }
            jobs.push({ id: result.jobId, provider: result.provider, sceneIndex: i });
          } catch (e) {
            errors.push(`Scene ${i + 1}: ${getErrorMessage(e)}`);
          }
        })
      );

      if (jobs.length === 0) {
        const allCapacityErrors = errors.length > 0 && errors.every((msg) => isProviderCapacityError(msg));

        // ── Slideshow fallback: generate images via Lovable AI gateway ──
        if (allCapacityErrors) {
          console.warn("All video providers exhausted — falling back to image slideshow");
          const lovableKey = Deno.env.get("LOVABLE_API_KEY");
          if (lovableKey) {
            try {
              const imageUrls: string[] = [];
              const serviceClient = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
              );

              for (const scenePrompt of scenePrompts) {
                const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${lovableKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-3.1-flash-image-preview",
                    messages: [
                      {
                        role: "user",
                        content: `Generate a high-quality, cinematic 16:9 photograph for this video scene. Photorealistic, dramatic lighting, professional composition. Scene: ${scenePrompt}`,
                      },
                    ],
                    modalities: ["image", "text"],
                  }),
                });

                if (!imgResp.ok) {
                  console.error("Lovable AI image generation failed:", imgResp.status);
                  continue;
                }

                const imgData = await imgResp.json();
                const b64Url = imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                if (!b64Url) continue;

                // Upload to storage
                const base64Data = b64Url.replace(/^data:image\/\w+;base64,/, "");
                const binaryStr = atob(base64Data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);

                const fileName = `${auth.userId}/${crypto.randomUUID()}.png`;
                await serviceClient.storage
                  .from("generated-videos")
                  .upload(fileName, bytes, { contentType: "image/png", upsert: false });

                const { data: pubData } = serviceClient.storage
                  .from("generated-videos")
                  .getPublicUrl(fileName);
                imageUrls.push(pubData.publicUrl);
              }

              if (imageUrls.length > 0) {
                return new Response(
                  JSON.stringify({
                    status: "completed",
                    mode: "slideshow",
                    imageUrls,
                    clipDuration,
                    totalScenes: sceneCount,
                    message: "Video providers unavailable — generated motion slideshow instead",
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            } catch (slideshowErr) {
              console.error("Slideshow fallback failed:", slideshowErr);
            }
          }
        }

        return new Response(
          JSON.stringify({
            status: "failed",
            error: `All scene generations failed: ${errors.join("; ")}`,
            errorCode: allCapacityErrors ? "provider_capacity_exhausted" : "generation_failed",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "pending",
          multiScene: true,
          totalScenes: sceneCount,
          clipDuration,
          jobs: jobs.sort((a, b) => a.sceneIndex - b.sceneIndex),
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Poll Multi-Scene (progressive upload: one clip per poll) ──
    if (action === "poll-multi") {
      if (!jobIds || jobIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "jobIds array is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Accept already-uploaded scene URLs from client
      const existingSceneUrls: Record<number, string> = parsedExistingSceneUrls || {};

      const results = await Promise.all(
        jobIds.map(async (job) => {
          try {
            // If this scene already has a URL, skip polling
            if (existingSceneUrls[job.sceneIndex]) {
              return { ...job, status: "completed", storageUrl: existingSceneUrls[job.sceneIndex] };
            }
            const jobApiKey = job.provider === "wan" ? dashscopeKey : job.provider === "veo" ? geminiKey : gptKey;
            if (!jobApiKey) return { ...job, status: "failed", error: "API key missing" };

            const result = job.provider === "wan"
              ? await wanPoll(jobApiKey, job.id)
              : job.provider === "veo"
                ? await veoPoll(jobApiKey, job.id)
                : await soraPoll(jobApiKey, job.id);
            return { ...job, ...result };
          } catch (e) {
            return { ...job, status: "failed", error: e instanceof Error ? e.message : "Poll error" };
          }
        })
      );

      const anyFailed = results.some(r => r.status === "failed");
      const completedCount = results.filter(r => r.status === "completed").length;

      // Progressive upload: pick ONE newly-completed scene that doesn't have a storageUrl yet, download + upload it
      const newlyCompleted = results.find(
        r => r.status === "completed" && !(r as any).storageUrl && !existingSceneUrls[r.sceneIndex]
      );

      const uploadedSceneUrls: Record<number, string> = { ...existingSceneUrls };

      if (newlyCompleted) {
        try {
          const sceneApiKey = newlyCompleted.provider === "wan" ? dashscopeKey : newlyCompleted.provider === "veo" ? geminiKey : gptKey;
          if (!sceneApiKey && newlyCompleted.provider !== "wan") throw new Error("API key missing for download");

          let clipBytes: Uint8Array;
          if (newlyCompleted.provider === "wan" && (newlyCompleted as any).videoUrl) {
            clipBytes = await wanDownloadBytes((newlyCompleted as any).videoUrl);
          } else if (newlyCompleted.provider === "veo" && (newlyCompleted as any).videoUrl) {
            clipBytes = await veoDownloadBytes(sceneApiKey!, (newlyCompleted as any).videoUrl);
          } else if (newlyCompleted.provider === "sora") {
            clipBytes = await soraDownloadBytes(sceneApiKey!, newlyCompleted.id);
          } else {
            throw new Error("Cannot download scene");
          }

          const url = await uploadToStorage(auth.userId, clipBytes);
          uploadedSceneUrls[newlyCompleted.sceneIndex] = url;
        } catch (e) {
          console.error(`Scene ${newlyCompleted.sceneIndex} upload error:`, e);
          // Don't fail the whole batch — retry next poll
        }
      }

      // Copy any existing storageUrls from results
      for (const r of results) {
        if ((r as any).storageUrl) {
          uploadedSceneUrls[r.sceneIndex] = (r as any).storageUrl;
        }
      }

      const totalScenes = results.length;
      const uploadedCount = Object.keys(uploadedSceneUrls).length;

      // All scenes uploaded?
      if (uploadedCount >= totalScenes && completedCount >= totalScenes) {
        const sorted = results.sort((a, b) => a.sceneIndex - b.sceneIndex);
        const sceneUrls = sorted.map(r => uploadedSceneUrls[r.sceneIndex]).filter(Boolean);

        if (sceneUrls.length === 0) {
          return new Response(
            JSON.stringify({ status: "failed", error: "No clips downloaded" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            status: "completed",
            sceneUrls,
            videoUrl: sceneUrls[0],
            savedToLibrary: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (anyFailed && completedCount === 0) {
        const failedErrors = results.filter(r => r.status === "failed").map(r => (r as any).error);
        return new Response(
          JSON.stringify({ status: "failed", error: failedErrors.join("; ") }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing — return progress + uploaded URLs so client sends them back
      const overallProgress = Math.round((uploadedCount / totalScenes) * 100);
      return new Response(
        JSON.stringify({
          status: "processing",
          progress: overallProgress,
          completedScenes: completedCount,
          uploadedScenes: uploadedCount,
          totalScenes,
          uploadedSceneUrls,
          scenes: results.map(r => ({
            sceneIndex: r.sceneIndex,
            status: r.status,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Poll (single) ──
    if (action === "poll") {
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: "jobId is required for polling" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = isWan
        ? await wanPoll(apiKey, jobId)
        : isVeo
          ? await veoPoll(apiKey, jobId)
          : await soraPoll(apiKey, jobId);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Download (proxy with auth headers) ──
    if (action === "download") {
      if (isWan) {
        if (!videoUrl) {
          return new Response(
            JSON.stringify({ error: "videoUrl is required for Wan download" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return await wanDownload(videoUrl);
      } else if (isVeo) {
        if (!videoUrl) {
          return new Response(
            JSON.stringify({ error: "videoUrl is required for Veo download" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return await veoDownload(apiKey, videoUrl);
      } else {
        if (!jobId) {
          return new Response(
            JSON.stringify({ error: "jobId is required for download" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return await soraDownload(apiKey, jobId);
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
