import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

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
  // Sora only supports 4, 8, 12 seconds — snap to nearest valid value
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
      duration: z.number().min(1).max(30).optional(),
      model: z.string().max(50).optional(),
    });
    const parsed = videoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { action, provider, prompt, jobId, duration, model } = parsed.data;

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
