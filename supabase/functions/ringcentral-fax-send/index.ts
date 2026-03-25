import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPER_ADMIN_EMAILS } from "../_shared/accessPolicies.ts";

const RC_SERVER = "https://platform.ringcentral.com";

async function getAccessToken(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: tokenRow } = await supabaseAdmin
    .from("user_ringcentral_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow?.refresh_token) return null;
  if (tokenRow.token_expires_at && new Date(tokenRow.token_expires_at) > new Date()) {
    return tokenRow.access_token;
  }

  const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID")!;
  const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET")!;

  const resp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });

  if (!resp.ok) {
    await supabaseAdmin.from("user_ringcentral_tokens").delete().eq("user_id", userId);
    return null;
  }

  const tokens = await resp.json();
  await supabaseAdmin.from("user_ringcentral_tokens").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq("user_id", userId);

  return tokens.access_token;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin } = ctx;

    // Super admin check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!SUPER_ADMIN_EMAILS.includes(profile?.email ?? "")) {
      return new Response(JSON.stringify({ error: "Forbidden: Super admin only" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const formData = await req.formData();
    const faxNumber = formData.get("fax_number") as string;
    const coverPageText = formData.get("cover_page_text") as string | null;
    const file = formData.get("file") as File | null;

    if (!faxNumber) {
      return new Response(JSON.stringify({ error: "fax_number required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const accessToken = await getAccessToken(supabaseAdmin, userId);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "RingCentral not connected" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const rcForm = new FormData();
    const faxJson = JSON.stringify({
      to: [{ phoneNumber: faxNumber }],
      faxResolution: "High",
      coverPageText: coverPageText || undefined,
    });
    rcForm.append("json", new Blob([faxJson], { type: "application/json" }));

    if (file) {
      rcForm.append("attachment", file, file.name);
    }

    const resp = await fetch(
      `${RC_SERVER}/restapi/v1.0/account/~/extension/~/fax`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: rcForm,
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Fax send failed:", data);
      return new Response(JSON.stringify({ error: "Failed to send fax", details: data }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return { success: true, fax_id: data.id, status: data.messageStatus };
  }, { functionName: "ringcentral-fax-send", parseBody: false, requireCompany: false, wrapResult: false })
);
