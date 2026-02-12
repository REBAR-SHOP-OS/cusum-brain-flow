import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);

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
    const agentId = Deno.env.get("ELEVENLABS_AGENT_ID");

    if (!apiKey || !agentId) {
      return json({ error: "ElevenLabs not configured" }, 500);
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
      { headers: { "xi-api-key": apiKey } }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs signed-url error:", err);
      return json({ error: "Failed to get signed URL" }, 502);
    }

    const { signed_url } = await response.json();
    return json({
      signed_url,
      preferred_language: profile.preferred_language ?? "en",
      preferred_voice_id: profile.preferred_voice_id ?? null,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("Unexpected error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
