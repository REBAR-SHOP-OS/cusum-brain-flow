import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard
    let userId: string;
    try {
      const auth = await requireAuth(req);
      userId = auth.userId;
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit
    const { data: allowed } = await svc.rpc("check_rate_limit", {
      _user_id: userId,
      _function_name: "relay-pipeline",
      _max_requests: 10,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json();
    const action = body.action || "process";

    // ─── ACTION: PROCESS (Layers 1-4) ────────────────────────────────
    if (action === "process") {
      // Get user profile for drafting
      const { data: profile } = await svc
        .from("profiles")
        .select("full_name, title")
        .eq("user_id", userId)
        .maybeSingle();
      const userName = profile?.full_name || "Team Member";
      const titleLine = profile?.title ? ` (${profile.title})` : "";

      // Fetch unprocessed inbound emails (batch of 10)
      const { data: unprocessed, error: fetchErr } = await svc
        .from("communications")
        .select("id, from_address, to_address, subject, body_preview, metadata, received_at, thread_id, source")
        .is("ai_processed_at", null)
        .eq("direction", "inbound")
        .order("received_at", { ascending: false })
        .limit(10);

      if (fetchErr) throw fetchErr;
      if (!unprocessed || unprocessed.length === 0) {
        return new Response(JSON.stringify({ processed: 0, message: "No unprocessed emails" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: { id: string; category: string; drafted: boolean }[] = [];

      for (const email of unprocessed) {
        const emailBody = (email.metadata as any)?.body || email.body_preview || "";
        const subject = email.subject || "(no subject)";
        const from = email.from_address || "Unknown";

        // ── Layer 1: Classify ──
        let classification: { category: string; urgency: string; action_required: boolean; reason: string };
        try {
          const classifyResp = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You classify inbound business emails for a rebar/steel manufacturing company." },
                { role: "user", content: `Classify this email.\n\nFrom: ${from}\nSubject: ${subject}\n\n${emailBody.slice(0, 2000)}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "classify_email",
                  description: "Classify the email into a category",
                  parameters: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["RFQ", "Active Customer", "Payment", "Vendor", "Internal", "Marketing", "Spam"] },
                      urgency: { type: "string", enum: ["high", "medium", "low"] },
                      action_required: { type: "boolean" },
                      reason: { type: "string" },
                    },
                    required: ["category", "urgency", "action_required", "reason"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "classify_email" } },
            }),
          });

          if (!classifyResp.ok) {
            console.error("Classify error:", classifyResp.status, await classifyResp.text());
            // Mark as processed with error to avoid infinite retry
            await svc.from("communications").update({ ai_processed_at: new Date().toISOString() }).eq("id", email.id);
            continue;
          }

          const classifyData = await classifyResp.json();
          const toolCall = classifyData.choices?.[0]?.message?.tool_calls?.[0];
          classification = JSON.parse(toolCall?.function?.arguments || '{"category":"Internal","urgency":"low","action_required":false,"reason":"parse error"}');
        } catch (e) {
          console.error("Classify parse error:", e);
          await svc.from("communications").update({ ai_processed_at: new Date().toISOString() }).eq("id", email.id);
          continue;
        }

        // If spam/marketing, tag and stop
        if (classification.category === "Spam" || classification.category === "Marketing") {
          await svc.from("communications").update({
            ai_category: classification.category,
            ai_urgency: classification.urgency,
            ai_action_required: false,
            ai_action_summary: classification.reason,
            ai_processed_at: new Date().toISOString(),
          }).eq("id", email.id);
          results.push({ id: email.id, category: classification.category, drafted: false });
          continue;
        }

        // ── Layer 2: Prioritize ──
        let priorityData: { action: string; deadline: string | null; risk_level: string; opportunity_value: string | null; next_step: string } = {
          action: classification.reason,
          deadline: null,
          risk_level: "low",
          opportunity_value: null,
          next_step: "Review and respond",
        };

        try {
          const priorityResp = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You extract priority data from business emails for a rebar manufacturing company. Be concise." },
                { role: "user", content: `Extract priority data.\n\nFrom: ${from}\nSubject: ${subject}\nCategory: ${classification.category}\n\n${emailBody.slice(0, 2000)}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "extract_priority",
                  description: "Extract priority information from the email",
                  parameters: {
                    type: "object",
                    properties: {
                      action: { type: "string", description: "One-sentence required action" },
                      deadline: { type: "string", description: "Deadline if mentioned, null otherwise" },
                      risk_level: { type: "string", enum: ["none", "low", "medium", "high"] },
                      opportunity_value: { type: "string", description: "Dollar estimate if sales opportunity, null otherwise" },
                      next_step: { type: "string", description: "Suggested next step" },
                    },
                    required: ["action", "risk_level", "next_step"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "extract_priority" } },
            }),
          });

          if (priorityResp.ok) {
            const pData = await priorityResp.json();
            const pToolCall = pData.choices?.[0]?.message?.tool_calls?.[0];
            if (pToolCall) {
              priorityData = JSON.parse(pToolCall.function.arguments);
            }
          }
        } catch (e) {
          console.error("Priority parse error:", e);
        }

        // ── Layer 3: Draft (if action required) ──
        let draft: string | null = null;
        if (classification.action_required) {
          try {
            const draftResp = await fetch(AI_GATEWAY, {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: `You are Cassie, an AI email assistant for ${userName}${titleLine} at Rebar.Shop (Ontario Rebars Ltd.). Draft professional, concise replies. Sign off with "Best regards,\\n${userName}". Do NOT include any email signature block.`,
                  },
                  {
                    role: "user",
                    content: `Draft a reply:\n\nFrom: ${from}\nSubject: ${subject}\n\n${emailBody.slice(0, 3000)}\n\nWrite only the reply text.`,
                  },
                ],
                max_tokens: 800,
                temperature: 0.4,
              }),
            });

            if (draftResp.ok) {
              const draftData = await draftResp.json();
              draft = draftData.choices?.[0]?.message?.content || null;
            }
          } catch (e) {
            console.error("Draft error:", e);
          }
        }

        // ── Layer 4: Alert check ──
        const shouldAlert =
          (classification.category === "RFQ" && classification.urgency === "high") ||
          (classification.category === "Payment" && (priorityData.risk_level === "high" || priorityData.risk_level === "medium")) ||
          (priorityData.action?.toLowerCase().includes("delivery") && priorityData.risk_level !== "none");

        if (shouldAlert) {
          try {
            // Check if alert already exists
            const { count } = await svc
              .from("comms_alerts")
              .select("id", { count: "exact", head: true })
              .eq("communication_id", email.id)
              .eq("alert_type", `relay_${classification.category.toLowerCase()}`);

            if (!count || count === 0) {
              await svc.from("comms_alerts").insert({
                alert_type: `relay_${classification.category.toLowerCase()}`,
                communication_id: email.id,
                owner_email: email.to_address || "",
                company_id: "a0000000-0000-0000-0000-000000000001",
                metadata: {
                  ai_category: classification.category,
                  ai_urgency: classification.urgency,
                  risk_level: priorityData.risk_level,
                  subject: email.subject,
                },
              });
            }
          } catch (e) {
            console.error("Alert insert error:", e);
          }
        }

        // ── Update the communication row ──
        await svc.from("communications").update({
          ai_category: classification.category,
          ai_urgency: classification.urgency,
          ai_action_required: classification.action_required,
          ai_action_summary: priorityData.action,
          ai_draft: draft,
          ai_processed_at: new Date().toISOString(),
          ai_priority_data: priorityData,
        }).eq("id", email.id);

        results.push({ id: email.id, category: classification.category, drafted: !!draft });
      }

      return new Response(JSON.stringify({ processed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: CLOSE-THREAD (Layer 5) ──────────────────────────────
    if (action === "close-thread") {
      const { communicationId } = body;
      if (!communicationId) throw new Error("communicationId required");

      const { data: comm } = await svc
        .from("communications")
        .select("id, subject, body_preview, from_address, to_address, received_at, metadata, thread_id")
        .eq("id", communicationId)
        .maybeSingle();

      if (!comm) throw new Error("Communication not found");

      // Get thread context if available
      let threadContext = "";
      if (comm.thread_id) {
        const { data: thread } = await svc
          .from("communications")
          .select("direction, from_address, body_preview, received_at")
          .eq("thread_id", comm.thread_id)
          .order("received_at", { ascending: true })
          .limit(5);
        if (thread) {
          threadContext = thread.map((t: any) => `[${t.direction}] ${t.from_address}: ${(t.body_preview || "").slice(0, 200)}`).join("\n");
        }
      }

      const emailBody = (comm.metadata as any)?.body || comm.body_preview || "";

      const summaryResp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Summarize this email thread in 2 concise sentences. Focus on what was discussed and the outcome." },
            { role: "user", content: `Subject: ${comm.subject}\nFrom: ${comm.from_address}\n\n${threadContext || emailBody.slice(0, 2000)}` },
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });

      let resolvedSummary = "Thread resolved.";
      if (summaryResp.ok) {
        const sData = await summaryResp.json();
        resolvedSummary = sData.choices?.[0]?.message?.content || resolvedSummary;
      }

      await svc.from("communications").update({
        resolved_at: new Date().toISOString(),
        resolved_summary: resolvedSummary,
      }).eq("id", communicationId);

      // Log event
      await svc.from("activity_events").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        entity_type: "communication",
        entity_id: communicationId,
        event_type: "thread_resolved",
        description: resolvedSummary,
        actor_id: userId,
        actor_type: "user",
        source: "system",
        dedupe_key: `thread_resolved:${communicationId}`,
      });

      return new Response(JSON.stringify({ success: true, summary: resolvedSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: RELAY-BRIEF ─────────────────────────────────────────
    if (action === "relay-brief") {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: recent } = await svc
        .from("communications")
        .select("ai_category, ai_urgency, ai_action_required, ai_priority_data, resolved_at, direction, from_address, subject")
        .gte("received_at", since)
        .eq("direction", "inbound");

      const total = recent?.length || 0;
      const rfqs = recent?.filter((r: any) => r.ai_category === "RFQ").length || 0;
      const payments = recent?.filter((r: any) => r.ai_category === "Payment").length || 0;
      const activeCustomer = recent?.filter((r: any) => r.ai_category === "Active Customer").length || 0;
      const spam = recent?.filter((r: any) => r.ai_category === "Spam" || r.ai_category === "Marketing").length || 0;
      const actionRequired = recent?.filter((r: any) => r.ai_action_required && !r.resolved_at).length || 0;
      const highUrgency = recent?.filter((r: any) => r.ai_urgency === "high").length || 0;
      const resolved = recent?.filter((r: any) => r.resolved_at).length || 0;

      const briefResp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "Generate a concise daily email brief for a rebar manufacturing company CEO. Use bullet points. Be direct." },
            {
              role: "user",
              content: `Generate today's Relay Brief:\n\nStats (last 24h):\n- Total inbound: ${total}\n- RFQs: ${rfqs}\n- Payments/Invoices: ${payments}\n- Active Customer: ${activeCustomer}\n- Spam/Marketing: ${spam}\n- Action required (open): ${actionRequired}\n- High urgency: ${highUrgency}\n- Resolved: ${resolved}\n\nTop subjects:\n${(recent || []).filter((r: any) => r.ai_urgency === "high").slice(0, 5).map((r: any) => `- ${r.subject} (from ${r.from_address})`).join("\n")}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      let briefText = `Relay Brief: ${total} inbound, ${rfqs} RFQs, ${actionRequired} need action.`;
      if (briefResp.ok) {
        const bData = await briefResp.json();
        briefText = bData.choices?.[0]?.message?.content || briefText;
      }

      return new Response(JSON.stringify({
        brief: briefText,
        stats: { total, rfqs, payments, activeCustomer, spam, actionRequired, highUrgency, resolved },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("relay-pipeline error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
