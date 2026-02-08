import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.190.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Facebook Data Deletion Request Callback
 * 
 * When a user removes your app from their Facebook settings,
 * Facebook sends a POST request here with a signed_request.
 * We delete that user's stored tokens and return a confirmation URL.
 * 
 * Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const signedRequest = formData.get("signed_request") as string;

    if (!signedRequest) {
      return new Response(
        JSON.stringify({ error: "Missing signed_request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the signed request
    const [encodedSig, payload] = signedRequest.split(".");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");

    if (!appSecret) {
      console.error("FACEBOOK_APP_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify signature using HMAC-SHA256
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Pad base64url payload for decoding
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decodedPayload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
      )
    );

    const fbUserId = decodedPayload.user_id;

    if (!fbUserId) {
      return new Response(
        JSON.stringify({ error: "No user_id in payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete user's Meta tokens
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find and delete tokens where meta_user_id matches the FB user ID
    // Also delete page tokens and integration connections
    const { data: tokens } = await supabaseAdmin
      .from("user_meta_tokens")
      .select("user_id, platform")
      .or(`meta_user_id.eq.${fbUserId},meta_user_name.eq.${fbUserId}`);

    if (tokens && tokens.length > 0) {
      for (const token of tokens) {
        // Delete all tokens for this user across platforms
        await supabaseAdmin
          .from("user_meta_tokens")
          .delete()
          .eq("user_id", token.user_id)
          .ilike("platform", "facebook%");

        await supabaseAdmin
          .from("user_meta_tokens")
          .delete()
          .eq("user_id", token.user_id)
          .ilike("platform", "instagram%");

        // Remove integration connection records
        await supabaseAdmin
          .from("integration_connections")
          .delete()
          .eq("user_id", token.user_id)
          .in("integration_id", ["facebook", "instagram"]);
      }
    }

    // Generate a confirmation code
    const confirmationCode = crypto.randomUUID();
    const statusUrl = `https://erp.rebar.shop/data-deletion?code=${confirmationCode}`;

    console.log(`Data deletion processed for FB user ${fbUserId}, code: ${confirmationCode}`);

    // Return the required JSON response
    return new Response(
      JSON.stringify({
        url: statusUrl,
        confirmation_code: confirmationCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Data deletion error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
