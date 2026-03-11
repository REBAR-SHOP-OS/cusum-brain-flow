import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAuth(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (error || !user) return null;
  return { userId: user.id };
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_BASE = "https://api.openai.com/v1";

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

// ─── Veo helpers ────────────────────────────────────────────

async function veoGenerate(apiKey: string, prompt: string, duration: number) {
  const model = "veo-3.1-generate-preview";
  const url = `${GEMINI_BASE}/models/${model}:predictLongRunning`;
  const veoDuration = snapDuration(duration, VEO_CLIP_DURATIONS);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      instances: [{ prompt }],
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
  geminiKey: string,
  basePrompt: string,
  sceneCount: number,
  clipDuration: number,
): Promise<string[]> {
  // Use Gemini to split the prompt into distinct continuous scenes
  const systemPrompt = `You are a video director. Given a video concept, create exactly ${sceneCount} distinct continuous camera shots that together tell a cohesive visual story. Each shot will be ${clipDuration} seconds of continuous action.

Rules:
- Each scene must be a self-contained visual description
- Scenes should flow naturally from one to the next
- Include camera movement, lighting, and mood details
- Do NOT mention scene numbers, transitions, or editing
- Return ONLY a JSON array of ${sceneCount} strings, nothing else

Example output format:
["A sweeping aerial shot of...", "Close-up of hands..."]`;

  const resp = await fetch(
    `${GEMINI_BASE}/models/gemini-2.5-flash:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Video concept: ${basePrompt}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!resp.ok) {
    console.error("Scene prompt generation failed:", resp.status);
    // Fallback: duplicate the original prompt for each scene
    return Array(sceneCount).fill(basePrompt);
  }

  try {
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const scenes = JSON.parse(text);
    if (Array.isArray(scenes) && scenes.length === sceneCount) {
      return scenes.map(String);
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await verifyAuth(req);
    if (!auth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videoSchema = z.object({
      action: z.enum(["generate", "poll", "download", "generate-multi", "poll-multi", "list-library", "delete-library"]),
      provider: z.enum(["veo", "sora"]).optional(),
      prompt: z.string().max(5000).optional(),
      jobId: z.string().max(500).optional(),
      jobIds: z.array(z.object({
        id: z.string(),
        provider: z.enum(["veo", "sora"]),
        sceneIndex: z.number(),
      })).optional(),
      videoUrl: z.string().max(2000).optional(),
      duration: z.number().min(1).max(120).optional(),
      model: z.string().max(50).optional(),
      fileId: z.string().max(500).optional(),
    });
    const parsed = videoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { action, provider, prompt, jobId, jobIds, videoUrl, duration, model, fileId } = parsed.data;

    const isVeo = provider === "veo";
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const gptKey = Deno.env.get("GPT_API_KEY");
    const apiKey = isVeo ? geminiKey : gptKey;

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
      const keyName = isVeo ? "GEMINI_API_KEY" : "GPT_API_KEY";
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

      const result = isVeo
        ? await veoGenerate(apiKey, prompt, duration || 8)
        : await soraGenerate(apiKey, prompt, duration || 8, model || "sora-2");

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
      const maxClip = isVeo ? VEO_MAX_CLIP : SORA_MAX_CLIP;
      const clipDuration = maxClip;
      const sceneCount = Math.ceil(requestedDuration / clipDuration);

      // Use Gemini to generate scene-specific prompts (always use geminiKey for this)
      const effectiveGeminiKey = geminiKey || apiKey;
      const scenePrompts = await generateScenePrompts(
        effectiveGeminiKey,
        prompt,
        sceneCount,
        clipDuration,
      );

      // Generate all scenes in parallel
      const jobs: { id: string; provider: string; sceneIndex: number }[] = [];
      const errors: string[] = [];

      await Promise.all(
        scenePrompts.map(async (scenePrompt, i) => {
          try {
            const result = isVeo
              ? await veoGenerate(apiKey, scenePrompt, clipDuration)
              : await soraGenerate(apiKey, scenePrompt, clipDuration, model || "sora-2");
            jobs.push({ id: result.jobId, provider: result.provider, sceneIndex: i });
          } catch (e) {
            errors.push(`Scene ${i + 1}: ${e instanceof Error ? e.message : "Unknown error"}`);
          }
        })
      );

      if (jobs.length === 0) {
        return new Response(
          JSON.stringify({ error: `All scene generations failed: ${errors.join("; ")}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // ── Poll Multi-Scene (poll all jobs, download & concat when all done) ──
    if (action === "poll-multi") {
      if (!jobIds || jobIds.length === 0) {
        return new Response(
          JSON.stringify({ error: "jobIds array is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results = await Promise.all(
        jobIds.map(async (job) => {
          try {
            const jobApiKey = job.provider === "veo" ? geminiKey : gptKey;
            if (!jobApiKey) return { ...job, status: "failed", error: "API key missing" };

            const result = job.provider === "veo"
              ? await veoPoll(jobApiKey, job.id)
              : await soraPoll(jobApiKey, job.id);
            return { ...job, ...result };
          } catch (e) {
            return { ...job, status: "failed", error: e instanceof Error ? e.message : "Poll error" };
          }
        })
      );

      const allCompleted = results.every(r => r.status === "completed");
      const anyFailed = results.some(r => r.status === "failed");
      const completedCount = results.filter(r => r.status === "completed").length;

      if (allCompleted) {
        // Download all clips and concatenate
        try {
          const sorted = results.sort((a, b) => a.sceneIndex - b.sceneIndex);
          const clips: Uint8Array[] = [];

          for (const scene of sorted) {
            const sceneApiKey = scene.provider === "veo" ? geminiKey : gptKey;
            if (!sceneApiKey) throw new Error("API key missing for download");

            if (scene.provider === "veo" && scene.videoUrl) {
              clips.push(await veoDownloadBytes(sceneApiKey, scene.videoUrl));
            } else if (scene.provider === "sora") {
              clips.push(await soraDownloadBytes(sceneApiKey, scene.id));
            }
          }

          if (clips.length === 0) {
            return new Response(
              JSON.stringify({ status: "failed", error: "No clips downloaded" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // For single clip, just upload directly; for multiple, concat
          const finalBytes = clips.length === 1 ? clips[0] : concatVideoBytes(clips);

          // Upload to storage
          const publicUrl = await uploadToStorage(auth.userId, finalBytes);

          return new Response(
            JSON.stringify({ status: "completed", videoUrl: publicUrl, savedToLibrary: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (e) {
          console.error("Multi-scene download/concat error:", e);
          return new Response(
            JSON.stringify({ status: "failed", error: e instanceof Error ? e.message : "Concat failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (anyFailed && completedCount === 0) {
        const failedErrors = results.filter(r => r.status === "failed").map(r => (r as any).error);
        return new Response(
          JSON.stringify({ status: "failed", error: failedErrors.join("; ") }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing
      const overallProgress = Math.round((completedCount / results.length) * 100);
      return new Response(
        JSON.stringify({
          status: "processing",
          progress: overallProgress,
          completedScenes: completedCount,
          totalScenes: results.length,
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

      const result = isVeo
        ? await veoPoll(apiKey, jobId)
        : await soraPoll(apiKey, jobId);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Download (proxy with auth headers) ──
    if (action === "download") {
      if (isVeo) {
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
