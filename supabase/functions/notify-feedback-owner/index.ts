import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient }) => {
    const record = body?.record;
    if (!record) {
      return new Response(JSON.stringify({ error: "No record" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { id: taskId, title, created_by_profile_id, source, status } = record;

    if (source !== "screenshot_feedback" || status !== "resolved") {
      return { skipped: true };
    }

    if (!created_by_profile_id) return { skipped: "no submitter" };

    const { data: submitter } = await serviceClient
      .from("profiles")
      .select("user_id, preferred_language, full_name")
      .eq("id", created_by_profile_id)
      .maybeSingle();

    if (!submitter?.user_id) {
      console.log("Submitter user_id not found:", created_by_profile_id);
      return { skipped: "submitter not found" };
    }

    const lang: string = submitter.preferred_language || "en";
    let notifTitle = "✅ Your feedback was resolved";
    let notifDesc = `The change you requested has been resolved: "${(title || "").slice(0, 100)}"`;

    if (lang !== "en") {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

        const translateRes = await fetch(`${SUPABASE_URL}/functions/v1/translate-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
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

    const { error: notifErr } = await serviceClient.from("notifications").insert({
      user_id: submitter.user_id, type: "notification",
      title: notifTitle, description: notifDesc,
      priority: "normal", link_to: "/tasks", agent_name: "Feedback", status: "unread",
      metadata: { task_id: taskId, resolved: true },
    });

    if (notifErr) {
      console.error("Failed to insert notification:", notifErr);
      throw new Error(notifErr.message);
    }

    return { ok: true, lang, user_id: submitter.user_id };
  }, { functionName: "notify-feedback-owner", authMode: "none", requireCompany: false, wrapResult: false, internalOnly: false })
);
