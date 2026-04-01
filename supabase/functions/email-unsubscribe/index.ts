import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient }) => {
    let token: string | null = null;

    // Support both GET (query param) and POST (body)
    if (req.method === "GET") {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    } else {
      token = body.token;
    }

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    let companyId: string | null = null;
    if (payload.campaign_id) {
      const { data: camp } = await serviceClient
        .from("email_campaigns")
        .select("company_id")
        .eq("id", payload.campaign_id)
        .maybeSingle();
      if (camp) companyId = camp.company_id;
    }
    if (!companyId) {
      companyId = await resolveDefaultCompanyId(serviceClient);
    }

    await serviceClient.from("email_suppressions").upsert({
      email, reason: "unsubscribe",
      source: payload.campaign_id || "direct",
      company_id: companyId,
    }, { onConflict: "email" });

    const { data: contact } = await serviceClient
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    await serviceClient.from("email_consent_events").insert({
      contact_id: contact?.id || null, email,
      consent_type: "marketing_email", status: "revoked",
      source: "unsubscribe_link",
      evidence: { campaign_id: payload.campaign_id, timestamp: new Date().toISOString(), method: "one_click" },
      company_id: companyId,
    });

    if (payload.campaign_id) {
      await serviceClient
        .from("email_campaign_sends")
        .update({ status: "unsubscribed" })
        .eq("campaign_id", payload.campaign_id)
        .eq("email", email);
    }

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

    return { message: "Successfully unsubscribed", email };
  }, { functionName: "email-unsubscribe", authMode: "none", requireCompany: false, rawResponse: true })
);
