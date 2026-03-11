import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

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

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (error || !user) return null;
  return user.id;
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_BASE = "https://api.openai.com/v1";

// ─── Veo helpers ────────────────────────────────────────────

async function veoGenerate(apiKey: string, prompt: string, duration: number) {
  const model = "veo-3.1-generate-preview";
  const url = `${GEMINI_BASE}/models/${model}:predictLongRunning`;

  // Veo 3.1 supports 4, 6, or 8 second durations
  const validDurations = [4, 6, 8];
  const rawDuration = duration || 6;
  const veoDuration = validDurations.reduce((prev, curr) =>
    Math.abs(curr - rawDuration) < Math.abs(prev - rawDuration) ? curr : prev
  );

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
    throw new Error(`Veo generation failed (${resp.status})`);
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
    // Veo 3.1 response structure
    const videos =
      data.response?.generateVideoResponse?.generatedSamples ||
      data.response?.generatedSamples ||
      data.result?.generateVideoResponse?.generatedSamples ||
      data.result?.generatedSamples ||
      [];
    const videoUri = videos[0]?.video?.uri || null;

    if (videoUri) {
      // Use header-based auth for download — client will fetch via proxy
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

async function veoDownload(apiKey: string, videoUrl: string) {
  const resp = await fetch(videoUrl, {
    headers: { "x-goog-api-key": apiKey },
  });

  if (!resp.ok) {
    throw new Error(`Veo download failed (${resp.status})`);
  }

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
  const validDurations = [4, 8, 12];
  const rawDuration = duration || 8;
  const soraDuration = validDurations.reduce((prev, curr) =>
    Math.abs(curr - rawDuration) < Math.abs(prev - rawDuration) ? curr : prev
  );

  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", model || "sora-2");
  formData.append("size", "1280x720");
  formData.append("seconds", String(soraDuration));

  const resp = await fetch(`${OPENAI_BASE}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Sora submit error:", resp.status, errText);
    throw new Error(`Sora generation failed (${resp.status})`);
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

async function soraDownload(apiKey: string, videoId: string) {
  const resp = await fetch(`${OPENAI_BASE}/videos/${videoId}/content`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!resp.ok) {
    throw new Error(`Sora download failed (${resp.status})`);
  }

  return new Response(resp.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

// ─── Main handler ───────────────────────────────────────────

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

    const videoSchema = z.object({
      action: z.enum(["generate", "poll", "download"]),
      provider: z.enum(["veo", "sora"]).optional(),
      prompt: z.string().max(5000).optional(),
      jobId: z.string().max(500).optional(),
      videoUrl: z.string().max(2000).optional(),
      duration: z.number().min(1).max(60).optional(),
      model: z.string().max(50).optional(),
    });
    const parsed = videoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { action, provider, prompt, jobId, videoUrl, duration, model } = parsed.data;

    const isVeo = provider === "veo";
    const apiKey = isVeo
      ? Deno.env.get("GEMINI_API_KEY")
      : Deno.env.get("GPT_API_KEY");

    if (!apiKey) {
      const keyName = isVeo ? "GEMINI_API_KEY" : "GPT_API_KEY";
      return new Response(
        JSON.stringify({ error: `${keyName} is not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Generate ──
    if (action === "generate") {
      if (!prompt || typeof prompt !== "string") {
        return new Response(
          JSON.stringify({ error: "A text prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = isVeo
        ? await veoGenerate(apiKey, prompt, duration)
        : await soraGenerate(apiKey, prompt, duration, model);

      return new Response(
        JSON.stringify({ ...result, status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Poll ──
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
      JSON.stringify({ error: 'Invalid action. Use "generate", "poll", or "download".' }),
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
