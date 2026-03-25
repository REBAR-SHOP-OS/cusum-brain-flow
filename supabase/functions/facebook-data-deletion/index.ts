import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient }) => {
    const formData = await req.formData();
    const signedRequest = formData.get("signed_request") as string;

    if (!signedRequest) {
      return new Response(JSON.stringify({ error: "Missing signed_request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [encodedSig, payload] = signedRequest.split(".");
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    if (!appSecret) {
      console.error("FACEBOOK_APP_SECRET not configured");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decodedPayload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
      )
    );

    const fbUserId = decodedPayload.user_id;
    if (!fbUserId) {
      return new Response(JSON.stringify({ error: "No user_id in payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens } = await serviceClient
      .from("user_meta_tokens")
      .select("user_id, platform")
      .or(`meta_user_id.eq.${fbUserId},meta_user_name.eq.${fbUserId}`);

    if (tokens && tokens.length > 0) {
      for (const token of tokens) {
        await serviceClient.from("user_meta_tokens").delete()
          .eq("user_id", token.user_id).ilike("platform", "facebook%");
        await serviceClient.from("user_meta_tokens").delete()
          .eq("user_id", token.user_id).ilike("platform", "instagram%");
        await serviceClient.from("integration_connections").delete()
          .eq("user_id", token.user_id).in("integration_id", ["facebook", "instagram"]);
      }
    }

    const confirmationCode = crypto.randomUUID();
    const statusUrl = `https://erp.rebar.shop/data-deletion?code=${confirmationCode}`;
    console.log(`Data deletion processed for FB user ${fbUserId}, code: ${confirmationCode}`);

    return { url: statusUrl, confirmation_code: confirmationCode };
  }, { functionName: "facebook-data-deletion", authMode: "none", requireCompany: false, parseBody: false, wrapResult: false })
);
