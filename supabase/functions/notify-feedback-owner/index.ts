import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * notify-feedback-owner
 * Called by a DB trigger (via net.http_post) when a feedback task status → 'resolved'.
 * Sends a localized in-app notification to the original submitter (created_by_profile_id)
 * in their preferred_language using the translate-message edge function.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const record = payload?.record;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { id: taskId, title, created_by_profile_id, source, status } = record;

    // Only process screenshot_feedback tasks that become resolved
    if (source !== "screenshot_feedback" || status !== "resolved") {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!created_by_profile_id) {
      return new Response(JSON.stringify({ skipped: "no submitter" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get submitter's user_id and preferred_language
    const { data: submitter } = await svcClient
      .from("profiles")
      .select("user_id, preferred_language, full_name")
      .eq("id", created_by_profile_id)
      .maybeSingle();

    if (!submitter?.user_id) {
      console.log("Submitter user_id not found:", created_by_profile_id);
      return new Response(JSON.stringify({ skipped: "submitter not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang: string = submitter.preferred_language || "en";

    // Base English notification texts
    let notifTitle = "✅ Your feedback was resolved";
    let notifDesc = `The change you requested has been resolved: "${(title || "").slice(0, 100)}"`;

    // Translate to submitter's preferred language if not English
    if (lang !== "en") {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

        const translateRes = await fetch(`${SUPABASE_URL}/functions/v1/translate-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            // Use service role to bypass rate limiting for internal calls
            "apikey": SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            text: notifTitle + "\n" + notifDesc,
            sourceLang: "en",
            targetLangs: [lang],
          }),
        });

        if (translateRes.ok) {
          const { translations } = await translateRes.json();
          const translatedText: string | undefined = translations?.[lang];
          if (translatedText) {
            const parts = translatedText.split("\n");
            notifTitle = parts[0] ?? notifTitle;
            notifDesc = parts.slice(1).join("\n").trim() || notifDesc;
          }
        }
      } catch (translateErr) {
        console.warn("Translation failed, using English:", translateErr);
      }
    }

    // Insert notification
    const { error: notifErr } = await svcClient.from("notifications").insert({
      user_id: submitter.user_id,
      type: "notification",
      title: notifTitle,
      description: notifDesc,
      priority: "normal",
      link_to: "/tasks",
      agent_name: "Feedback",
      status: "unread",
      metadata: { task_id: taskId, resolved: true },
    });

    if (notifErr) {
      console.error("Failed to insert notification:", notifErr);
      return new Response(JSON.stringify({ error: notifErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, lang, user_id: submitter.user_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-feedback-owner error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
