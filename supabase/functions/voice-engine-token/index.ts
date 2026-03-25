import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * Generic Voice Engine Token Minter
 * Accepts instructions, voice, model, and VAD config.
 * Returns an ephemeral OpenAI Realtime client_secret for WebRTC.
 * 
 * SECURITY: Validates JWT to prevent unauthorized token minting.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: verify JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── OpenAI session creation ──
    const GPT_API_KEY = Deno.env.get("GPT_API_KEY");
    if (!GPT_API_KEY) throw new Error("GPT_API_KEY not configured");

    const body = await req.json();
    const {
      instructions = "You are a helpful assistant.",
      voice = "alloy",
      model = "gpt-4o-mini-realtime-preview",
      vadThreshold = 0.4,
      silenceDurationMs = 300,
      prefixPaddingMs = 200,
      temperature = 0.8,
    } = body;

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ["audio", "text"],
        instructions,
        temperature,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: vadThreshold,
          prefix_padding_ms: prefixPaddingMs,
          silence_duration_ms: silenceDurationMs,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI Realtime session error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to create realtime session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionData = await response.json();
    const clientSecret = sessionData.client_secret?.value;

    if (!clientSecret) {
      console.error("No client_secret in response:", JSON.stringify(sessionData));
      return new Response(
        JSON.stringify({ error: "No client secret received" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        client_secret: clientSecret,
        expires_at: sessionData.client_secret?.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("voice-engine-token error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
