import { handleRequest } from "../_shared/requestHandler.ts";

const RATE_LIMIT_PER_MINUTE = 50;
const DELAY_MS = Math.ceil(60000 / RATE_LIMIT_PER_MINUTE);

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabaseAdmin, body } = ctx;

    const { campaign_id } = body;
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

    // Get eligible contacts
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

    let sentCount = 0;
    let failCount = 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const unsubscribeBase = `${supabaseUrl}/functions/v1/email-unsubscribe`;

    for (const contact of eligible) {
      try {
        const unsubToken = btoa(JSON.stringify({
          email: contact.email,
          campaign_id,
          ts: Date.now(),
        }));
        const unsubscribeUrl = `${unsubscribeBase}?token=${encodeURIComponent(unsubToken)}`;

        const personalizedHtml = (campaign.body_html || "")
          .replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl)
          .replace(/\{\{first_name\}\}/g, contact.first_name || "")
          .replace(/\{\{last_name\}\}/g, contact.last_name || "");

        await supabaseAdmin.from("email_campaign_sends").insert({
          campaign_id,
          contact_id: contact.id,
          email: contact.email,
          status: "queued",
        });

        const listUnsubscribeHeaders: Record<string, string> = {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        };

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
            custom_headers: listUnsubscribeHeaders,
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

    return {
      message: `Campaign sent. ${sentCount} delivered, ${failCount} failed.`,
      sent: sentCount,
      failed: failCount,
    };
  }, { functionName: "email-campaign-send", requireCompany: false, wrapResult: false })
);
