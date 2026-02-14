import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let token: string | null = null;

    // Support both GET (query param) and POST (body)
    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode token
    let payload: { email: string; campaign_id?: string };
    try {
      payload = JSON.parse(atob(token));
    } catch {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payload.email) {
      return new Response(JSON.stringify({ error: "Invalid token: no email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = payload.email.toLowerCase();

    // Get company_id from campaign or default
    let companyId = "a0000000-0000-0000-0000-000000000001";
    if (payload.campaign_id) {
      const { data: camp } = await supabaseAdmin
        .from("email_campaigns")
        .select("company_id")
        .eq("id", payload.campaign_id)
        .maybeSingle();
      if (camp) companyId = camp.company_id;
    }

    // Add to suppressions
    await supabaseAdmin.from("email_suppressions").upsert({
      email,
      reason: "unsubscribe",
      source: payload.campaign_id || "direct",
      company_id: companyId,
    }, { onConflict: "email" });

    // Log consent revocation
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    await supabaseAdmin.from("email_consent_events").insert({
      contact_id: contact?.id || null,
      email,
      consent_type: "marketing_email",
      status: "revoked",
      source: "unsubscribe_link",
      evidence: {
        campaign_id: payload.campaign_id,
        timestamp: new Date().toISOString(),
        method: "one_click",
      },
      company_id: companyId,
    });

    // Update campaign send status if applicable
    if (payload.campaign_id) {
      await supabaseAdmin
        .from("email_campaign_sends")
        .update({ status: "unsubscribed" })
        .eq("campaign_id", payload.campaign_id)
        .eq("email", email);
    }

    // For GET requests, return a simple HTML page
    if (req.method === "GET") {
      return new Response(
        `<!DOCTYPE html><html><head><title>Unsubscribed</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h1>✓ Unsubscribed</h1>
        <p>You have been removed from our mailing list.</p>
        <p style="color:#888;font-size:12px;">Rebar.Shop</p>
        </body></html>`,
        { headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Successfully unsubscribed", email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("email-unsubscribe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
