import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

// Backward-compatible proxy — forwards to ad-director-ai with action: "analyze-script"
Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
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
  }, { functionName: "analyze-ad-script", requireCompany: false, rawResponse: true })
);
