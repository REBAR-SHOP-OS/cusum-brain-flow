import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

const ALLOWED_EMAIL = "sattar@rebar.shop";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, serviceClient } = await requireAuth(req);

    // Fetch email from profiles table
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.email) {
      return json({ error: "Profile not found" }, 404);
    }

    if (profile.email !== ALLOWED_EMAIL) {
      return json({ error: "Forbidden" }, 403);
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
    return json({ signed_url });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("Unexpected error:", e);
    return json({ error: "Internal server error" }, 500);
  }
});
