import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient }) => {
    const { type, table, record } = body;
    if (type !== "INSERT" || table !== "notifications" || !record) {
      return { skipped: true };
    }

    const { user_id, title, description, link_to, metadata } = record;
    if (!user_id || !title) {
      return { skipped: true, reason: "missing user_id or title" };
    }

    const tag = metadata?.channel_id
      ? `team-${metadata.channel_id}`
      : metadata?.conversation_id
        ? `support-${metadata.conversation_id}`
        : `notif-${record.id?.slice(0, 8) || "default"}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    if (!resp.ok || result?.error) {
      console.error("Push delivery failed:", { status: resp.status, result });
      try {
        await serviceClient.from("activity_events").insert({
          company_id: record.company_id,
          entity_type: "notification",
          entity_id: record.id || "unknown",
          event_type: "push_failed",
          source: "system",
          description: `Push failed for notification "${title}": ${result?.error || resp.status}`,
          metadata: { user_id, push_status: resp.status, push_error: result?.error },
          dedupe_key: `push_fail_${record.id}`,
        }, { onConflict: "dedupe_key", ignoreDuplicates: true } as any);
      } catch (logErr) {
        console.error("Failed to log push failure:", logErr);
      }
      return { ok: false, push: result };
    }

    return { ok: true, push: result };
  }, { functionName: "push-on-notify", authMode: "none", requireCompany: false, wrapResult: false })
);
