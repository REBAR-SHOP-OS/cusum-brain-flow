import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { translateNotification } from "../_shared/notifyTranslate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * translate-notification
 * Called by a DB trigger on INSERT into notifications.
 * Fetches the recipient's preferred_language from profiles.
 * If not "en", translates title + description and updates the row.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const record = payload?.record;

    if (!record) {
      return new Response(JSON.stringify({ skipped: "no record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { id: notifId, user_id, title, description } = record;
    if (!user_id || !title) {
      return new Response(JSON.stringify({ skipped: "missing user_id or title" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);

    // Get recipient's preferred language
    const { data: profile } = await svc
      .from("profiles")
      .select("preferred_language")
      .eq("user_id", user_id)
      .maybeSingle();

    const lang = profile?.preferred_language || "en";
    if (lang === "en") {
      return new Response(JSON.stringify({ skipped: "english user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate title + description
    const { title: localTitle, body: localBody } = await translateNotification(
      supabaseUrl,
      anonKey,
      title,
      description || "",
      lang
    );

    // Only update if translation actually changed something
    if (localTitle !== title || localBody !== (description || "")) {
      const { error } = await svc
        .from("notifications")
        .update({ title: localTitle, description: localBody })
        .eq("id", notifId);

      if (error) {
        console.error("Failed to update translated notification:", error);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, lang, notifId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("translate-notification error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
