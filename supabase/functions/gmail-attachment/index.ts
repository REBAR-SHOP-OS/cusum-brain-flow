import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/tokenEncryption.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

async function getAccessToken(serviceClient: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: tokenRow } = await serviceClient
    .from("user_gmail_tokens")
    .select("refresh_token, is_encrypted")
    .eq("user_id", userId)
    .maybeSingle();

  let refreshToken = tokenRow?.refresh_token;
  if (refreshToken && tokenRow?.is_encrypted) {
    refreshToken = await decryptToken(refreshToken);
  }

  if (!refreshToken) throw new Error("Gmail not connected.");

  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Gmail OAuth credentials not configured");

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

  if (!response.ok) throw new Error(`Token refresh failed: ${await response.text()}`);
  const data = await response.json();
  return data.access_token;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { messageId, attachmentId } = ctx.body;
    if (!messageId || !attachmentId) {
      return new Response(JSON.stringify({ error: "messageId and attachmentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(ctx.serviceClient, ctx.userId);

    const attRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!attRes.ok) {
      throw new Error(`Gmail attachment API error: ${await attRes.text()}`);
    }

    const attData = await attRes.json();
    const base64Data = (attData.data || "").replace(/-/g, "+").replace(/_/g, "/");

    return { data: base64Data, size: attData.size };
  }, { functionName: "gmail-attachment", requireCompany: false, wrapResult: false })
);
