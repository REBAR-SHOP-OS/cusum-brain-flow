import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const OPENAI_BASE = "https://api.openai.com/v1";

// ─── Veo helpers ────────────────────────────────────────────

async function veoGenerate(apiKey: string, prompt: string, duration: number) {
  const model = "veo-3.0-generate-preview";
  const url = `${GEMINI_BASE}/models/${model}:predictLongRunning?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        durationSeconds: duration || 5,
        aspectRatio: "16:9",
        personGeneration: "allow_adult",
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Veo submit error:", resp.status, errText);
    throw new Error(`Veo generation failed (${resp.status})`);
  }

  const data = await resp.json();
  console.log("Veo operation created:", data.name);
  return { jobId: data.name, provider: "veo" };
}

async function veoPoll(apiKey: string, operationName: string) {
  const pollUrl = `${GEMINI_BASE}/${operationName}?key=${apiKey}`;
  const resp = await fetch(pollUrl);

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Veo poll error:", resp.status, errText);
    throw new Error(`Veo polling failed (${resp.status})`);
  }

  const data = await resp.json();

  if (data.done) {
    const videos = data.response?.generatedSamples || data.result?.generatedSamples || [];
    const videoUri = videos[0]?.video?.uri || null;

    if (videoUri) {
      const videoUrl = videoUri.includes("?")
        ? `${videoUri}&key=${apiKey}`
        : `${videoUri}?key=${apiKey}`;
      return { status: "completed", videoUrl };
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

// ─── Sora helpers ───────────────────────────────────────────

async function soraGenerate(apiKey: string, prompt: string, duration: number, model: string) {
  // Sora API uses multipart/form-data via curl, but JSON also works with the REST API
  const formData = new FormData();
  formData.append("prompt", prompt);
  formData.append("model", model || "sora-2");
  formData.append("size", "1280x720");
  formData.append("seconds", String(Math.min(duration || 5, 20)));

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
  console.log("Sora job created:", data.id, "status:", data.status);
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
    // Build the download URL — client will fetch via our proxy action
    const videoUrl = `${OPENAI_BASE}/videos/${videoId}/content`;
    return { status: "completed", videoUrl, needsAuth: true };
  }

  if (data.status === "failed") {
    return { status: "failed", error: data.error?.message || "Sora generation failed" };
  }

  // queued or in_progress
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
    const body = await req.json();
    const { action, provider, prompt, jobId, duration, model } = body;

    // Determine which API key to use
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

      console.log(`[${provider}] Generating video for: "${prompt.slice(0, 80)}"`);

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

    // ── Download (Sora only — needs auth header proxy) ──
    if (action === "download" && !isVeo) {
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: "jobId is required for download" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return await soraDownload(apiKey, jobId);
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
