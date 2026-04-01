import { handleRequest } from "../_shared/requestHandler.ts";
import { encryptToken, decryptToken } from "../_shared/tokenEncryption.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

async function getAccessTokenForUser(userId: string, clientIp: string): Promise<string> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow } = await supabaseAdmin
    .from("user_gmail_tokens")
    .select("refresh_token, is_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  let refreshToken = tokenRow?.refresh_token;
  if (refreshToken && tokenRow?.is_encrypted) {
    refreshToken = await decryptToken(refreshToken);
  }

  if (!refreshToken) {
    const sharedToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
    if (sharedToken) {
      refreshToken = sharedToken;
    }
  }

  if (!refreshToken) {
    throw new Error("Gmail not connected. Please connect your Gmail account first.");
  }

  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Gmail OAuth credentials not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (error.includes("invalid_grant")) {
      await supabaseAdmin.from("user_gmail_tokens").delete().eq("user_id", userId);
      throw new Error("Gmail token expired. Please reconnect your Gmail account.");
    }
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  if (data.refresh_token) {
    const encNew = await encryptToken(data.refresh_token);
    await supabaseAdmin
      .from("user_gmail_tokens")
      .update({ refresh_token: encNew, is_encrypted: true, token_rotated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  await supabaseAdmin
    .from("user_gmail_tokens")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: clientIp })
    .eq("user_id", userId);

  return data.access_token;
}

interface EmailAttachment {
  filename: string;
  contentType: string;
  base64: string;
}

function createRawEmail(
  to: string,
  subject: string,
  body: string,
  fromEmail: string,
  replyTo?: { messageId: string; references: string },
  customHeaders?: Record<string, string>,
  cc?: string,
  bcc?: string,
  attachments?: EmailAttachment[]
): string {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const hasAttachments = attachments && attachments.length > 0;

  const emailLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
  ];

  if (cc) emailLines.push(`Cc: ${cc}`);
  if (bcc) emailLines.push(`Bcc: ${bcc}`);

  emailLines.push(
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
  );

  if (hasAttachments) {
    emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  } else {
    emailLines.push("Content-Type: text/html; charset=utf-8");
  }

  if (replyTo) {
    emailLines.push(`In-Reply-To: ${replyTo.messageId}`);
    emailLines.push(`References: ${replyTo.references || replyTo.messageId}`);
  }

  if (customHeaders) {
    for (const [key, value] of Object.entries(customHeaders)) {
      emailLines.push(`${key}: ${value}`);
    }
  }

  if (hasAttachments) {
    emailLines.push("");
    emailLines.push(`--${boundary}`);
    emailLines.push("Content-Type: text/html; charset=utf-8");
    emailLines.push("");
    emailLines.push(body);

    for (const att of attachments!) {
      emailLines.push(`--${boundary}`);
      emailLines.push(`Content-Type: ${att.contentType}; name="${att.filename}"`);
      emailLines.push("Content-Transfer-Encoding: base64");
      emailLines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      emailLines.push("");
      // Gmail API expects standard base64 in the MIME part
      emailLines.push(att.base64);
    }

    emailLines.push(`--${boundary}--`);
  } else {
    emailLines.push("", body);
  }

  const email = emailLines.join("\r\n");
  const base64 = btoa(unescape(encodeURIComponent(email)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface SendEmailRequest {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  replyToMessageId?: string;
  references?: string;
  sent_by_agent?: boolean;
  custom_headers?: Record<string, string>;
  attachments?: EmailAttachment[];
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin, body: rawBody, req: originalReq, companyId } = ctx;

    const sendSchema = z.object({
      to: z.string().email("Invalid recipient email").max(320),
      cc: z.string().email().max(320).optional(),
      bcc: z.string().email().max(320).optional(),
      subject: z.string().min(1, "Subject required").max(998),
      body: z.string().min(1, "Body required").max(500000),
      threadId: z.string().max(100).optional(),
      replyToMessageId: z.string().max(500).optional(),
      references: z.string().max(2000).optional(),
      sent_by_agent: z.boolean().optional(),
      custom_headers: z.record(z.string()).optional(),
      attachments: z.array(z.object({
        filename: z.string().max(255),
        contentType: z.string().max(255),
        base64: z.string(),
      })).max(5).optional(),
    });
    const parsed = sendSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { to, cc, bcc, subject, body, threadId, replyToMessageId, references, sent_by_agent, custom_headers, attachments: emailAttachments } = parsed.data;

    // --- Comms Engine: no_act_global + email routing ---
    if (sent_by_agent) {
      const { data: commsConfig } = await supabaseAdmin
        .from("comms_config")
        .select("no_act_global, external_sender, internal_sender, internal_domain")
        .eq("company_id", companyId)
        .maybeSingle();

      if (commsConfig?.no_act_global) {
        return new Response(
          JSON.stringify({ blocked: true, reason: "tracking_only" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const clientIp = originalReq.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const accessToken = await getAccessTokenForUser(userId, clientIp);

    const { data: sigRow } = await supabaseAdmin
      .from("email_signatures")
      .select("signature_html")
      .eq("user_id", userId)
      .maybeSingle();
    const signature = sigRow?.signature_html || "";

    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!profileResponse.ok) {
      throw new Error("Failed to get Gmail profile");
    }

    const profile = await profileResponse.json();
    let fromEmail = profile.emailAddress;

    if (sent_by_agent) {
      const { data: commsConfig } = await supabaseAdmin
        .from("comms_config")
        .select("external_sender, internal_sender, internal_domain")
        .eq("company_id", companyId)
        .maybeSingle();

      if (commsConfig) {
        const recipientDomain = to.split("@")[1]?.toLowerCase() || "";
        fromEmail = recipientDomain === commsConfig.internal_domain
          ? commsConfig.internal_sender
          : commsConfig.external_sender;
      }
    }

    const styledBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a;">${body}</div>`;
    const bodyWithSig = signature ? `${styledBody}<br>${signature}` : styledBody;

    const raw = createRawEmail(
      to,
      subject,
      bodyWithSig,
      fromEmail,
      replyToMessageId ? { messageId: replyToMessageId, references: references || "" } : undefined,
      custom_headers,
      cc,
      bcc,
      emailAttachments
    );

    let sendResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw,
          ...(threadId && { threadId }),
        }),
      }
    );

    if (!sendResponse.ok && sendResponse.status === 404 && threadId) {
      console.warn("Gmail 404 with threadId, retrying without threadId | userId:", userId);
      await sendResponse.text();
      sendResponse = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        }
      );
    }

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Gmail API send failed:", sendResponse.status, errorText, "| userId:", userId, "| fromEmail:", fromEmail);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await sendResponse.json();

    try {
      await supabaseAdmin.from("activity_events").insert({
        company_id: companyId,
        entity_type: "email",
        entity_id: result.id || crypto.randomUUID(),
        event_type: "email_sent",
        description: `Sent email to ${to}: ${subject.slice(0, 100)}`,
        source: "gmail",
        actor_id: userId,
        actor_type: sent_by_agent ? "agent" : "user",
        metadata: { to, subject, threadId: result.threadId, fromEmail },
      });
    } catch { /* non-critical logging */ }

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    };
  }, { functionName: "gmail-send", requireCompany: false, wrapResult: false })
);
