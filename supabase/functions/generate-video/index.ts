import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, prompt, operationName, duration } = await req.json();

    // Action: "generate" — submit a new video generation request
    if (action === "generate") {
      if (!prompt || typeof prompt !== "string") {
        return new Response(
          JSON.stringify({ error: "A text prompt is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const model = "veo-3.0-generate-preview";
      const url = `${GEMINI_BASE}/models/${model}:predictLongRunning?key=${GEMINI_API_KEY}`;

      const body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          durationSeconds: duration || 5,
          aspectRatio: "16:9",
          personGeneration: "allow_adult",
        },
      };

      console.log("Submitting Veo generation request for prompt:", prompt.slice(0, 80));

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Veo submit error:", resp.status, errText);
        return new Response(
          JSON.stringify({ error: `Video generation failed (${resp.status})` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await resp.json();
      console.log("Veo operation created:", data.name);

      return new Response(
        JSON.stringify({ operationName: data.name, status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: "poll" — check the status of a pending operation
    if (action === "poll") {
      if (!operationName) {
        return new Response(
          JSON.stringify({ error: "operationName is required for polling" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pollUrl = `${GEMINI_BASE}/${operationName}?key=${GEMINI_API_KEY}`;
      const resp = await fetch(pollUrl);

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("Veo poll error:", resp.status, errText);
        return new Response(
          JSON.stringify({ error: `Polling failed (${resp.status})` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await resp.json();

      if (data.done) {
        // Extract video from the response
        const videos = data.response?.generatedSamples || data.result?.generatedSamples || [];
        const videoUri = videos[0]?.video?.uri || null;

        if (videoUri) {
          // Fetch the actual video data using the file URI
          // The URI looks like: "https://generativelanguage.googleapis.com/v1beta/files/..."
          const videoUrl = videoUri.includes("?") 
            ? `${videoUri}&key=${GEMINI_API_KEY}` 
            : `${videoUri}?key=${GEMINI_API_KEY}`;

          return new Response(
            JSON.stringify({ status: "completed", videoUrl }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check for errors in the response
        const error = data.error || data.response?.error;
        if (error) {
          return new Response(
            JSON.stringify({ status: "failed", error: error.message || "Video generation failed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ status: "completed", videoUrl: null, raw: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Still processing
      const metadata = data.metadata || {};
      return new Response(
        JSON.stringify({
          status: "processing",
          progress: metadata.percentComplete || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "generate" or "poll".' }),
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
