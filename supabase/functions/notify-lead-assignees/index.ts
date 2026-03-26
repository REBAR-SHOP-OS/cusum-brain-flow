import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { decryptToken } from "../_shared/tokenEncryption.ts";
import { buildBrandedEmail, textToHtml, fetchActorSignature } from "../_shared/brandedEmail.ts";

serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient, body, log } = ctx;
    const {
      sales_lead_id,
      event_type,   // "note" | "stage_change"
      note_text,    // plain text of the log note (no attachment URLs)
      new_stage,    // stage label (for stage_change)
      actor_name,   // who performed the action
      actor_id,     // user ID of actor (for signature lookup)
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

    // 3. Fetch actor email to exclude from recipients
    let actorEmail = "";
    if (actor_id) {
      const { data: actorProfile } = await serviceClient
        .from("profiles")
        .select("email")
        .eq("id", actor_id)
        .maybeSingle();
      actorEmail = actorProfile?.email?.toLowerCase() || "";
    }

    // 4. Build recipient list (exclude actor — don't email yourself)
    const recipients: { email: string; full_name: string }[] = [];
    for (const a of assignees as any[]) {
      const profile = a.profiles;
      if (!profile?.email) continue;

      const email: string = profile.email;
      const fullName: string = profile.full_name || email;

      // Skip the actor — they already know what they did
      if (actorEmail && email.toLowerCase() === actorEmail) continue;

      const isInternal = email.toLowerCase().endsWith("@rebar.shop");

      if (isInternal) {
        recipients.push({ email, full_name: fullName });
      } else {
        if (event_type === "note" && note_text) {
          const mentionPattern = new RegExp(`@${fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          if (mentionPattern.test(note_text)) {
            recipients.push({ email, full_name: fullName });
          }
        }
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

    // 5. Fetch actor signature
    const signatureHtml = actor_id ? await fetchActorSignature(serviceClient, actor_id) : null;

    // 6. Build email content
    const recordLink = `https://cusum-brain-flow.lovable.app/sales/pipeline?lead=${sales_lead_id}`;
    const subject = `ERP | Rebar.shop | ${lead.title}`;

    let actionDesc = "";
    if (event_type === "stage_change") {
      actionDesc = `${actor_name || "Someone"} changed the stage to "<strong>${new_stage || "unknown"}</strong>".`;
    } else {
      actionDesc = `${actor_name || "Someone"} added a note.`;
    }

    // Strip attachment URLs from note text
    let cleanNote = "";
    if (note_text) {
      cleanNote = note_text
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("http"))
        .join("\n")
        .trim();
    }

    // Build branded HTML for internal recipients
    const internalBodyHtml = `
      <p style="margin:0 0 12px;font-size:14px;color:#555;">${actionDesc}</p>
      ${cleanNote ? `<div style="background:#f8f9fa;border-left:3px solid #1a1a2e;padding:12px 16px;border-radius:4px;margin:12px 0;">${textToHtml(cleanNote)}</div>` : ""}
    `;

    const internalEmail = buildBrandedEmail({
      bodyHtml: internalBodyHtml,
      signatureHtml: signatureHtml || undefined,
      actorName: actor_name || undefined,
      recordLink,
    });

    // Build branded HTML for customer recipients (no internal links)
    const customerBodyHtml = cleanNote
      ? `<div style="font-size:14px;color:#333;line-height:1.7;">${textToHtml(cleanNote)}</div>`
      : `<p style="margin:0 0 12px;font-size:14px;color:#333;">${actionDesc}</p>`;

    const customerEmailHtml = buildBrandedEmail({
      bodyHtml: customerBodyHtml,
      signatureHtml: signatureHtml || undefined,
      actorName: actor_name || "Rebar.shop Team",
    });

    // 6. Get Gmail access token — actor first, then ai@rebar.shop, then admin fallback
    const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID");
    const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

    if (!gmailClientId || !gmailClientSecret) {
      throw new Error("Gmail OAuth credentials not configured");
    }

    let refreshToken: string | null = null;
    let senderUserId: string | null = null;
    let senderEmail = "ai@rebar.shop";

    // Priority 1: Actor's own Gmail token
    if (actor_id) {
      const { data: actorToken } = await serviceClient
        .from("user_gmail_tokens")
        .select("refresh_token, is_encrypted")
        .eq("user_id", actor_id)
        .maybeSingle();

      if (actorToken?.refresh_token) {
        refreshToken = actorToken.is_encrypted
          ? await decryptToken(actorToken.refresh_token)
          : actorToken.refresh_token;
        senderUserId = actor_id;

        // Get actor's email for From header
        const { data: actorProfile } = await serviceClient
          .from("profiles")
          .select("email")
          .eq("id", actor_id)
          .maybeSingle();
        if (actorProfile?.email) senderEmail = actorProfile.email;
        log.info(`Using actor's own Gmail token (${senderEmail})`);
      }
    }

    // Priority 2: ai@rebar.shop
    if (!refreshToken) {
      const { data: aiProfile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", "ai@rebar.shop")
        .maybeSingle();

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
          senderUserId = aiProfile.id;
          senderEmail = "ai@rebar.shop";
          log.info("Using ai@rebar.shop token");
        }
      }
    }

    // Priority 3: Any admin with a valid token
    if (!refreshToken) {
      log.info("No actor/ai token, trying admin fallback");
      const { data: adminTokens } = await serviceClient
        .from("user_gmail_tokens")
        .select("user_id, refresh_token, is_encrypted")
        .not("refresh_token", "is", null);

      if (adminTokens) {
        for (const candidate of adminTokens) {
          const { data: roleRow } = await serviceClient
            .from("user_roles")
            .select("role")
            .eq("user_id", candidate.user_id)
            .eq("role", "admin")
            .maybeSingle();

          if (roleRow) {
            refreshToken = candidate.is_encrypted
              ? await decryptToken(candidate.refresh_token)
              : candidate.refresh_token;
            senderUserId = candidate.user_id;

            const { data: adminProfile } = await serviceClient
              .from("profiles")
              .select("email")
              .eq("id", candidate.user_id)
              .maybeSingle();
            if (adminProfile?.email) senderEmail = adminProfile.email;
            log.info(`Using admin fallback token from ${senderEmail}`);
            break;
          }
        }
      }
    }

    // Priority 4: Env var fallback
    if (!refreshToken) {
      refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN") || null;
    }

    if (!refreshToken) {
      throw new Error("No Gmail refresh token found — no actor, ai@rebar.shop, or admin fallback available");
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
    if (tokenData.refresh_token && senderUserId) {
      try {
        const { encryptToken } = await import("../_shared/tokenEncryption.ts");
        const encNew = await encryptToken(tokenData.refresh_token);
        await serviceClient
          .from("user_gmail_tokens")
          .update({ refresh_token: encNew, is_encrypted: true, token_rotated_at: new Date().toISOString() })
          .eq("user_id", senderUserId);
      } catch (e) {
        log.error("Token rotation save failed", e);
      }
    }

    let sentCount = 0;
    for (const recipient of recipients) {
      try {
        const isCustomer = customerEmail && recipient.email.toLowerCase() === customerEmail;
        const htmlBody = isCustomer ? customerEmailHtml : internalEmail;

        const rawEmail = [
          `From: ${senderEmail}`,
          `To: ${recipient.email}`,
          `Subject: ${subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          "",
          htmlBody,
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
