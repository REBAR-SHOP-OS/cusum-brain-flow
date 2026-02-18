import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");
    if (!ELEVENLABS_AGENT_ID) throw new Error("ELEVENLABS_AGENT_ID not configured");

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs signed URL error:", response.status, errText);
      return json({ error: "Failed to get signed URL" }, 500);
    }

    const { signed_url } = await response.json();
    return json({ signed_url });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("elevenlabs-conversation-token error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
