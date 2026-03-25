import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/auth.ts";

// Backward-compatible proxy — forwards to ad-director-ai with action: "analyze-script"
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    const proxyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ad-director-ai`;
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        Authorization: req.headers.get("Authorization") || "",
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify({
        action: "analyze-script",
        ...body,
      }),
    });

    const data = await response.json();

    // Unwrap the result to match old API shape
    if (data.result) {
      return new Response(JSON.stringify(data.result), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-ad-script proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
