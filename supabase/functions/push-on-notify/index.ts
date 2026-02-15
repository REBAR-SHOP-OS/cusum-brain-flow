import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function is triggered by a database webhook on notifications INSERT.
// It calls send-push for each new notification so the user gets a push alert on all devices.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { type, table, record } = await req.json();
    if (type !== "INSERT" || table !== "notifications" || !record) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, title, description, link_to, metadata } = record;
    if (!user_id || !title) {
      return new Response(JSON.stringify({ skipped: true, reason: "missing user_id or title" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine a tag to group/replace notifications
    const tag = metadata?.channel_id
      ? `team-${metadata.channel_id}`
      : metadata?.conversation_id
        ? `support-${metadata.conversation_id}`
        : `notif-${record.id?.slice(0, 8) || "default"}`;

    // Call send-push
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        user_id,
        title,
        body: (description || "").slice(0, 200),
        linkTo: link_to || "/",
        tag,
      }),
    });

    const result = await resp.json();
    return new Response(JSON.stringify({ ok: true, push: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("push-on-notify error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
