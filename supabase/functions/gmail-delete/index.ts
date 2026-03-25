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
  if (!refreshToken) {
    const shared = Deno.env.get("GMAIL_REFRESH_TOKEN");
    if (shared) refreshToken = shared;
  }
  if (!refreshToken) throw new Error("Gmail not connected");

  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { messageId } = ctx.body;
    if (!messageId) {
      return new Response(JSON.stringify({ error: "messageId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(ctx.serviceClient, ctx.userId);

    const trashRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
      { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!trashRes.ok) {
      const errText = await trashRes.text();
      console.error("Gmail trash failed:", errText);
      return new Response(
        JSON.stringify({ error: "gmail_trash_failed", message: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await trashRes.json();
    return { success: true };
  }, { functionName: "gmail-delete", requireCompany: false, wrapResult: false })
);
