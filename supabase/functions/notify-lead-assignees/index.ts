import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { decryptToken } from "../_shared/tokenEncryption.ts";

serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient, body, log } = ctx;
    const {
      sales_lead_id,
      event_type,   // "note" | "stage_change"
      note_text,    // plain text of the log note (no attachment URLs)
      new_stage,    // stage label (for stage_change)
      actor_name,   // who performed the action
    } = body;

    if (!sales_lead_id) throw new Error("sales_lead_id is required");

    // 1. Fetch lead title
    const { data: lead, error: leadErr } = await serviceClient
      .from("sales_leads")
      .select("title, contact_email, contact_name")
      .eq("id", sales_lead_id)
      .single();
    if (leadErr) throw new Error("Lead not found: " + leadErr.message);

    // 2. Fetch assignees + profile emails
    const { data: assignees, error: assErr } = await serviceClient
      .from("sales_lead_assignees")
      .select("profile_id, profiles:profile_id(full_name, email)")
      .eq("sales_lead_id", sales_lead_id);
    if (assErr) throw new Error("Failed to fetch assignees: " + assErr.message);

    if (!assignees || assignees.length === 0) {
      log.info("No assignees found, skipping notifications");
      return { sent: 0 };
    }

    // 3. Build recipient list
    const recipients: { email: string; full_name: string }[] = [];
    for (const a of assignees as any[]) {
      const profile = a.profiles;
      if (!profile?.email) continue;

      const email: string = profile.email;
      const fullName: string = profile.full_name || email;
      const isInternal = email.toLowerCase().endsWith("@rebar.shop");

      if (isInternal) {
        // Internal always gets notified
        recipients.push({ email, full_name: fullName });
      } else {
        // Vendor: only if @mentioned in note text
        if (event_type === "note" && note_text) {
          const mentionPattern = new RegExp(`@${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          if (mentionPattern.test(note_text)) {
            recipients.push({ email, full_name: fullName });
          }
        }
        // Vendors do NOT get stage_change notifications
      }
    }

    // Add customer (contact_email) as recipient if available
    const customerEmail = lead.contact_email?.trim().toLowerCase() || "";
    if (customerEmail) {
      const alreadyIncluded = recipients.some(r => r.email.toLowerCase() === customerEmail);
      if (!alreadyIncluded) {
        recipients.push({ email: lead.contact_email, full_name: lead.contact_name || lead.contact_email });
      }
    }

    if (recipients.length === 0) {
      log.info("No qualifying recipients");
      return { sent: 0 };
    }

    // 4. Build email content
    const recordLink = `https://cusum-brain-flow.lovable.app/sales/pipeline?lead=${sales_lead_id}`;
    const subject = `ERP | Rebar.shop | ${lead.title}`;

    let actionDesc = "";
    if (event_type === "stage_change") {
      actionDesc = `${actor_name || "Someone"} changed the stage to "${new_stage || "unknown"}".`;
    } else {
      actionDesc = `${actor_name || "Someone"} added a note.`;
    }

    // Strip attachment URLs from note text (lines starting with http)
    let cleanNote = "";
    if (note_text) {
      cleanNote = note_text
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("http"))
        .join("\n")
        .trim();
    }

    // Internal email body (with record link)
    const internalEmailBody = [
      actionDesc,
      cleanNote ? `\n${cleanNote}` : "",
      `\nView record: ${recordLink}`,
    ].join("\n").trim();

    // Customer email body (professional, no internal links)
    const customerEmailBody = [
      cleanNote || actionDesc,
      `\nBest regards,\nRebar.shop Team`,
    ].join("\n").trim();

    // 5. Get Gmail access token for ai@rebar.shop from DB
    const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID");
    const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

    if (!gmailClientId || !gmailClientSecret) {
      throw new Error("Gmail OAuth credentials not configured");
    }

    // Look up ai@rebar.shop profile → get user_id → fetch token from DB
    const { data: aiProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", "ai@rebar.shop")
      .maybeSingle();

    let refreshToken: string | null = null;

    if (aiProfile?.id) {
      const { data: tokenRow } = await serviceClient
        .from("user_gmail_tokens")
        .select("refresh_token, is_encrypted")
        .eq("user_id", aiProfile.id)
        .maybeSingle();

      if (tokenRow?.refresh_token) {
        refreshToken = tokenRow.is_encrypted
          ? await decryptToken(tokenRow.refresh_token)
          : tokenRow.refresh_token;
      }
    }

    // Fallback to env var
    if (!refreshToken) {
      refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN") || null;
    }

    if (!refreshToken) {
      throw new Error("No Gmail refresh token found for ai@rebar.shop");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: gmailClientId,
        client_secret: gmailClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      log.error("Gmail token refresh failed:", JSON.stringify(tokenData));
      throw new Error("Failed to get Gmail access token: " + (tokenData.error || "unknown"));
    }

    // Handle token rotation
    if (tokenData.refresh_token && aiProfile?.id) {
      try {
        const { encryptToken } = await import("../_shared/tokenEncryption.ts");
        const encNew = await encryptToken(tokenData.refresh_token);
        await serviceClient
          .from("user_gmail_tokens")
          .update({ refresh_token: encNew, is_encrypted: true, token_rotated_at: new Date().toISOString() })
          .eq("user_id", aiProfile.id);
      } catch (e) {
        log.error("Token rotation save failed", e);
      }
    }

    let sentCount = 0;
    for (const recipient of recipients) {
      try {
        const isCustomer = customerEmail && recipient.email.toLowerCase() === customerEmail;
        const body = isCustomer ? customerEmailBody : internalEmailBody;

        // Build RFC 2822 email
        const rawEmail = [
          `From: ai@rebar.shop`,
          `To: ${recipient.email}`,
          `Subject: ${subject}`,
          `Content-Type: text/plain; charset=UTF-8`,
          "",
          body,
        ].join("\r\n");

        const encodedMessage = btoa(unescape(encodeURIComponent(rawEmail)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const sendRes = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encodedMessage }),
          }
        );

        if (sendRes.ok) {
          sentCount++;
          log.info(`Notification sent to ${recipient.email}`);
        } else {
          const err = await sendRes.text();
          log.error(`Failed to send to ${recipient.email}: ${err}`);
        }
      } catch (err) {
        log.error(`Error sending to ${recipient.email}`, err);
      }
    }

    return { sent: sentCount, total: recipients.length };
  }, { functionName: "notify-lead-assignees", requireCompany: false })
);
