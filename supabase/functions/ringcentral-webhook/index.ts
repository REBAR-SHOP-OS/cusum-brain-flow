import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // RingCentral validation handshake
  const validationToken = req.headers.get("Validation-Token");
  if (validationToken) {
    return new Response("", {
      status: 200,
      headers: {
        "Validation-Token": validationToken,
        "Content-Type": "application/json",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify webhook secret token (passed as query param when registering the webhook URL)
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expectedToken = Deno.env.get("RINGCENTRAL_WEBHOOK_SECRET");
  if (expectedToken && token !== expectedToken) {
    console.error("Invalid or missing webhook token");
    return new Response("Forbidden", { status: 403 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const event = body?.event;
    const subscriptionId = body?.subscriptionId;

    if (!event) {
      console.warn("No event in RC webhook body");
      return new Response("OK", { status: 200 });
    }

    console.log(`RC webhook: event=${event}, subscriptionId=${subscriptionId}`);

    if (event.includes("/telephony/sessions") || event.includes("/call-log")) {
      await handleCallEvent(supabase, body);
    } else if (event.includes("/message-store")) {
      await handleMessageEvent(supabase, body);
    } else {
      console.log("Unhandled RC event type:", event);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("ringcentral-webhook error:", error);
    return new Response("OK", { status: 200 });
  }
});

// ─── Link call event to call_tasks for idempotency ─────────────────────────

async function linkCallToTask(supabase: any, phone: string, sessionId: string) {
  // Normalize phone for matching (strip +1 prefix, etc.)
  const normalizedPhone = phone.replace(/^\+1/, "").replace(/\D/g, "");
  
  // Find matching call_task by phone + active status
  const { data: task } = await supabase
    .from("call_tasks")
    .select("id, status, rc_session_id")
    .or(`phone.eq.${phone},phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`)
    .in("status", ["dialing", "in_call"])
    .maybeSingle();

  if (!task) return;

  // If already has this session ID, skip (idempotency)
  if (task.rc_session_id === sessionId) {
    console.log(`call_task ${task.id} already linked to session ${sessionId}`);
    return;
  }

  // Store rc_session_id and update status
  const update: Record<string, any> = { rc_session_id: sessionId };
  if (task.status === "dialing") {
    update.status = "in_call";
  }

  await supabase
    .from("call_tasks")
    .update(update)
    .eq("id", task.id);

  console.log(`Linked call_task ${task.id} to RC session ${sessionId}`);
}

// ─── Call event handler ─────────────────────────────────────────────────────

async function handleCallEvent(supabase: any, body: any) {
  const callBody = body.body;
  if (!callBody) return;

  const calls = callBody.changes || [callBody];

  for (const call of calls) {
    const callId = call.id || call.sessionId || `rc-call-${Date.now()}`;
    const dedupeKey = `rc:call:${callId}`;

    // Check dedupe
    const { data: existing } = await supabase
      .from("activity_events")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existing) continue;

    // Try to link to call_tasks
    const fromNumber = call.from?.phoneNumber || call.from?.name || "Unknown";
    const toNumber = call.to?.phoneNumber || call.to?.name || "Unknown";
    const sessionId = call.sessionId || String(callId);

    // Link outbound calls to call_tasks
    const direction = (call.direction || "").toLowerCase();
    if (direction === "outbound" && toNumber !== "Unknown") {
      await linkCallToTask(supabase, toNumber, sessionId);
    } else if (direction === "inbound" && fromNumber !== "Unknown") {
      await linkCallToTask(supabase, fromNumber, sessionId);
    }

    // Determine user
    const extensionId = call.extension?.id || callBody.extensionId;
    let userId: string | null = null;
    let companyId: string | null = null;

    if (extensionId) {
      const { data: tokenRow } = await supabase
        .from("user_ringcentral_tokens")
        .select("user_id")
        .eq("rc_extension_id", String(extensionId))
        .maybeSingle();

      if (tokenRow) {
        userId = tokenRow.user_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", userId)
          .maybeSingle();
        companyId = profile?.company_id;
      }
    }

    if (!companyId) {
      const { data: firstProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .not("company_id", "is", null)
        .limit(1)
        .maybeSingle();
      companyId = firstProfile?.company_id;
    }

    if (!companyId) {
      console.warn("Cannot determine company for RC call event");
      continue;
    }

    const result = call.result || call.telephonyStatus || "Unknown";
    const duration = call.duration || 0;

    const { error: upsertErr } = await supabase
      .from("communications")
      .upsert({
        source: "ringcentral",
        source_id: String(callId),
        thread_id: call.sessionId || String(callId),
        from_address: fromNumber,
        to_address: toNumber,
        subject: `${direction} call - ${result}`,
        body_preview: `Duration: ${Math.floor(duration / 60)}m ${duration % 60}s`,
        received_at: call.startTime || new Date().toISOString(),
        direction: direction || "inbound",
        status: result === "Missed" ? "unread" : "read",
        metadata: {
          type: "call",
          duration,
          result,
          action: call.action,
          ...(call.recording ? {
            recording_id: call.recording.id,
            recording_uri: call.recording.contentUri,
          } : {}),
        },
        user_id: userId,
        company_id: companyId,
      }, {
        onConflict: "source,source_id",
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      console.error("RC call upsert error:", upsertErr);
      continue;
    }

    await supabase.from("activity_events").upsert({
      entity_type: "communication",
      entity_id: String(callId),
      event_type: "call_logged",
      actor_id: userId,
      actor_type: "system",
      description: `${direction} call ${fromNumber} → ${toNumber}: ${result}`,
      company_id: companyId,
      source: "ringcentral",
      dedupe_key: dedupeKey,
      metadata: { callId, direction, result, duration, fromNumber, toNumber },
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  }
}

// ─── Message event handler ──────────────────────────────────────────────────

async function handleMessageEvent(supabase: any, body: any) {
  const msgBody = body.body;
  if (!msgBody) return;

  const messages = msgBody.changes || [msgBody];

  for (const msg of messages) {
    const msgId = msg.id || `rc-msg-${Date.now()}`;
    const dedupeKey = `rc:sms:${msgId}`;

    const { data: existing } = await supabase
      .from("activity_events")
      .select("id")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existing) continue;

    const extensionId = msg.extension?.id || msgBody.extensionId;
    let userId: string | null = null;
    let companyId: string | null = null;

    if (extensionId) {
      const { data: tokenRow } = await supabase
        .from("user_ringcentral_tokens")
        .select("user_id")
        .eq("rc_extension_id", String(extensionId))
        .maybeSingle();

      if (tokenRow) {
        userId = tokenRow.user_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", userId)
          .maybeSingle();
        companyId = profile?.company_id;
      }
    }

    if (!companyId) {
      const { data: firstProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .not("company_id", "is", null)
        .limit(1)
        .maybeSingle();
      companyId = firstProfile?.company_id;
    }

    if (!companyId) continue;

    const fromAddr = msg.from?.phoneNumber || msg.from?.name || "Unknown";
    const toAddr = (msg.to || []).map((t: any) => t.phoneNumber || t.name).join(", ") || "Unknown";
    const direction = (msg.direction || "").toLowerCase();

    const { error: upsertErr } = await supabase
      .from("communications")
      .upsert({
        source: "ringcentral",
        source_id: String(msgId),
        thread_id: msg.conversationId || String(msgId),
        from_address: fromAddr,
        to_address: toAddr,
        subject: msg.subject || "SMS",
        body_preview: msg.subject || "",
        received_at: msg.creationTime || new Date().toISOString(),
        direction: direction || "inbound",
        status: msg.readStatus === "Unread" ? "unread" : "read",
        metadata: { type: "sms" },
        user_id: userId,
        company_id: companyId,
      }, {
        onConflict: "source,source_id",
        ignoreDuplicates: false,
      });

    if (upsertErr) {
      console.error("RC SMS upsert error:", upsertErr);
      continue;
    }

    await supabase.from("activity_events").upsert({
      entity_type: "communication",
      entity_id: String(msgId),
      event_type: "sms_received",
      actor_id: userId,
      actor_type: "system",
      description: `SMS ${fromAddr} → ${toAddr}`,
      company_id: companyId,
      source: "ringcentral",
      dedupe_key: dedupeKey,
      metadata: { msgId, direction, fromAddr, toAddr },
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  }
}
