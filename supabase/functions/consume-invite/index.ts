import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, email } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceKey);

    // Get the invite token
    const { data: invite, error: fetchErr } = await client
      .from("invite_tokens")
      .select("*")
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (fetchErr || !invite) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Bind the invite to the email it was issued for. This prevents
    // an attacker who obtains an invite link from applying it to a different
    // account and inheriting the company/role.
    if (invite.email && email.toLowerCase() !== String(invite.email).toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email does not match invite" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    await client
      .from("invite_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Find the user by the invite's email (authoritative) and assign company/role
    const targetEmail = String(invite.email || email).toLowerCase();
    const { data: userData } = await client.auth.admin.listUsers();
    const user = userData?.users?.find((u: any) => (u.email || "").toLowerCase() === targetEmail);

    if (user && invite.company_id) {
      await client
        .from("profiles")
        .update({ company_id: invite.company_id })
        .eq("id", user.id);

      if (invite.role && invite.role !== "user") {
        await client
          .from("user_roles")
          .upsert(
            { user_id: user.id, role: invite.role },
            { onConflict: "user_id,role" }
          );
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
