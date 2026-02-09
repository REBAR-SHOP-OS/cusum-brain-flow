import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  return user.id;
}

async function getAccessTokenForUser(userId: string, clientIp: string): Promise<string> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: tokenRow } = await supabaseAdmin
    .from("user_gmail_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();

  let refreshToken = tokenRow?.refresh_token;

  // Fallback to shared env var if user email matches
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

  // Track usage for anomaly detection
  await supabaseAdmin
    .from("user_gmail_tokens")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: clientIp })
    .eq("user_id", userId);

  return data.access_token;
}

function createRawEmail(to: string, subject: string, body: string, fromEmail: string, replyTo?: { messageId: string; references: string }): string {
  const emailLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
  ];

  if (replyTo) {
    emailLines.push(`In-Reply-To: ${replyTo.messageId}`);
    emailLines.push(`References: ${replyTo.references || replyTo.messageId}`);
  }

  emailLines.push("", body);

  const email = emailLines.join("\r\n");
  const base64 = btoa(unescape(encodeURIComponent(email)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  replyToMessageId?: string;
  references?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clonedReq = req.clone();

    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, subject, body, threadId, replyToMessageId, references }: SendEmailRequest = await clonedReq.json();

    if (!to || !subject || !body) {
      throw new Error("Missing required fields: to, subject, body");
    }

    // Use this user's own Gmail token with IP tracking
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const accessToken = await getAccessTokenForUser(userId, clientIp);
    console.log("Authenticated userId:", userId, "| sending to:", to);

    // Fetch user's email signature
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: sigRow } = await supabaseAdmin
      .from("email_signatures")
      .select("signature_html")
      .eq("user_id", userId)
      .maybeSingle();
    const signature = sigRow?.signature_html || "";

    // Get user's email address
    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!profileResponse.ok) {
      throw new Error("Failed to get Gmail profile");
    }

    const profile = await profileResponse.json();
    const fromEmail = profile.emailAddress;

    // Append signature to body
    const bodyWithSig = signature ? `${body}<br><br>${signature}` : body;

    const raw = createRawEmail(
      to,
      subject,
      bodyWithSig,
      fromEmail,
      replyToMessageId ? { messageId: replyToMessageId, references: references || "" } : undefined
    );

    const sendResponse = await fetch(
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

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Gmail API send failed:", sendResponse.status, errorText, "| userId:", userId, "| fromEmail:", fromEmail);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const result = await sendResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.id,
        threadId: result.threadId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});