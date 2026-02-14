import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_PER_MINUTE = 50;
const DELAY_MS = Math.ceil(60000 / RATE_LIMIT_PER_MINUTE); // ~1200ms between sends

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    // Load campaign
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();
    if (campErr || !campaign) throw new Error("Campaign not found");

    // Safety gates
    if (campaign.status !== "approved") {
      throw new Error(`Campaign must be approved before sending (current: ${campaign.status})`);
    }
    if (!campaign.approved_by) {
      throw new Error("Campaign must have an approver");
    }
    if (!campaign.body_html?.includes("{{unsubscribe_url}}") && !campaign.body_html?.includes("unsubscribe")) {
      throw new Error("Campaign body must include an unsubscribe link");
    }

    // Check no_act_global safety switch
    const { data: commsConfig } = await supabaseAdmin
      .from("comms_config")
      .select("no_act_global")
      .eq("company_id", campaign.company_id)
      .maybeSingle();
    if (commsConfig?.no_act_global) {
      throw new Error("Global no-act switch is ON. Sending is disabled.");
    }

    // Update to sending
    await supabaseAdmin
      .from("email_campaigns")
      .update({ status: "sending" })
      .eq("id", campaign_id);

    // Get eligible contacts (have email, not suppressed)
    const { data: suppressedEmails } = await supabaseAdmin
      .from("email_suppressions")
      .select("email");
    const suppressSet = new Set((suppressedEmails || []).map((s: any) => s.email.toLowerCase()));

    const { data: contacts } = await supabaseAdmin
      .from("contacts")
      .select("id, email, first_name, last_name")
      .not("email", "is", null);

    const eligible = (contacts || []).filter(
      (c: any) => c.email && !suppressSet.has(c.email.toLowerCase())
    );

    // TODO: Apply segment_rules filtering here for targeted campaigns
    // For MVP, send to all non-suppressed contacts with email

    let sentCount = 0;
    let failCount = 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get the unsubscribe base URL
    const unsubscribeBase = `${supabaseUrl}/functions/v1/email-unsubscribe`;

    for (const contact of eligible) {
      try {
        // Create unsubscribe token (simple base64 for MVP)
        const unsubToken = btoa(JSON.stringify({
          email: contact.email,
          campaign_id,
          ts: Date.now(),
        }));
        const unsubscribeUrl = `${unsubscribeBase}?token=${encodeURIComponent(unsubToken)}`;

        // Replace unsubscribe placeholder
        const personalizedHtml = (campaign.body_html || "")
          .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
          .replace(/\{\{first_name\}\}/g, contact.first_name || "")
          .replace(/\{\{last_name\}\}/g, contact.last_name || "");

        // Log the send
        await supabaseAdmin.from("email_campaign_sends").insert({
          campaign_id,
          contact_id: contact.id,
          email: contact.email,
          status: "queued",
        });

        // Send via gmail-send
        const sendResp = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: contact.email,
            subject: campaign.subject_line || "No Subject",
            body: personalizedHtml,
          }),
        });

        if (sendResp.ok) {
          await supabaseAdmin
            .from("email_campaign_sends")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("campaign_id", campaign_id)
            .eq("email", contact.email);
          sentCount++;
        } else {
          const errText = await sendResp.text();
          await supabaseAdmin
            .from("email_campaign_sends")
            .update({ status: "bounced", error_message: errText.substring(0, 500) })
            .eq("campaign_id", campaign_id)
            .eq("email", contact.email);

          // Auto-suppress bounces
          if (sendResp.status >= 400) {
            await supabaseAdmin.from("email_suppressions").upsert({
              email: contact.email.toLowerCase(),
              reason: "bounce",
              source: campaign_id,
              company_id: campaign.company_id,
            }, { onConflict: "email" }).select();
          }
          failCount++;
        }

        // Rate limit
        await new Promise((r) => setTimeout(r, DELAY_MS));
      } catch (err) {
        console.error(`Failed to send to ${contact.email}:`, err);
        failCount++;
      }
    }

    // Update campaign status
    await supabaseAdmin
      .from("email_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        estimated_recipients: sentCount,
      })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        message: `Campaign sent. ${sentCount} delivered, ${failCount} failed.`,
        sent: sentCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("email-campaign-send error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
