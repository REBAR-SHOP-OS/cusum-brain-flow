import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);

    // Parse optional mode from request body
    let mode = "voice_chat";
    try {
      const body = await req.json();
      if (body?.mode) mode = body.mode;
    } catch { /* no body or invalid JSON – default mode */ }

    // Check: user must be admin OR have voice_enabled in profile
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("voice_enabled, preferred_language, preferred_voice_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return json({ error: "Profile not found" }, 404);
    }

    // Check admin role
    const { data: adminRole } = await serviceClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!adminRole;
    const voiceEnabled = profile.voice_enabled === true;

    if (!isAdmin && !voiceEnabled) {
      return json({ error: "Voice not enabled for this user" }, 403);
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    
    // Use a dedicated phone agent ID for outbound calls, fall back to default
    const phoneAgentId = Deno.env.get("ELEVENLABS_PHONE_AGENT_ID");
    const defaultAgentId = Deno.env.get("ELEVENLABS_AGENT_ID");
    
    const agentId = mode === "phone_call" && phoneAgentId
      ? phoneAgentId
      : defaultAgentId;

    if (!apiKey || !agentId) {
      return json({ error: "ElevenLabs not configured" }, 500);
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs token error:", err);
      return json({ error: "Failed to get conversation token" }, 502);
    }

    const { token } = await response.json();
    return json({
      token,
      signed_url: token, // backward compat
      mode,
      preferred_language: profile.preferred_language ?? "en",
      preferred_voice_id: profile.preferred_voice_id ?? null,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("Unexpected error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
