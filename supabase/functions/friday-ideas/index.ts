import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull business context
    const [
      fixRes, taskRes, machineRes, orderRes, deliveryRes
    ] = await Promise.all([
      svc.from("vizzy_fix_requests").select("id, title, severity, status").eq("status", "open").limit(20),
      svc.from("human_tasks").select("id, title, severity, category, status").in("status", ["open", "snoozed"]).limit(20),
      svc.from("machines").select("id, name, status, type").in("status", ["blocked", "down"]),
      svc.from("orders").select("id, order_number, status, total_amount").in("status", ["pending", "confirmed"]).limit(20),
      svc.from("deliveries").select("id, delivery_number, status").in("status", ["planned", "loading"]).limit(10),
    ]);

    const context = {
      openFixRequests: fixRes.data?.length || 0,
      fixSamples: (fixRes.data || []).slice(0, 5).map((f: any) => `[${f.severity}] ${f.title}`),
      staleTasks: taskRes.data?.length || 0,
      taskSamples: (taskRes.data || []).slice(0, 5).map((t: any) => `[${t.severity}] ${t.title}`),
      machinesDown: (machineRes.data || []).map((m: any) => `${m.name}: ${m.status}`),
      pendingOrders: orderRes.data?.length || 0,
      pendingDeliveries: deliveryRes.data?.length || 0,
    };

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are ARIA, the Platform Supervisor for a rebar manufacturing business.

Based on this weekly business snapshot, suggest 3-5 actionable improvement ideas for:
1. rebar.shop (WordPress/WooCommerce website)
2. The ERP (production, orders, delivery management)
3. Odoo CRM (lead pipeline, customer sync)

Business Snapshot:
- Open fix requests: ${context.openFixRequests} ${context.fixSamples.length ? "\n  " + context.fixSamples.join("\n  ") : ""}
- Stale human tasks: ${context.staleTasks} ${context.taskSamples.length ? "\n  " + context.taskSamples.join("\n  ") : ""}
- Machines down/blocked: ${context.machinesDown.length ? context.machinesDown.join(", ") : "None"}
- Pending orders: ${context.pendingOrders}
- Pending deliveries: ${context.pendingDeliveries}

Format each idea as:
**[Platform] Idea Title**
Brief description of what to improve and expected impact.

Keep it practical and prioritized by business impact.`;

    const aiResp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.5,
        }),
      }
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("Gemini error:", aiResp.status, errText);
      throw new Error("AI service error");
    }

    const aiData = await aiResp.json();
    const ideas = aiData.choices?.[0]?.message?.content || "No ideas generated.";

    // Find admin users to notify (scoped via profiles)
    const { data: adminProfiles } = await svc
      .from("profiles")
      .select("user_id, user_roles!inner(role)")
      .eq("is_active", true);
    const admins = (adminProfiles || [])
      .filter((p: any) => p.user_roles?.some((r: any) => r.role === "admin"));

    for (const admin of admins || []) {
      await svc.from("notifications").insert({
        user_id: admin.user_id,
        type: "notification",
        title: "💡 Weekly Improvement Ideas from ARIA",
        description: ideas.slice(0, 500),
        priority: "normal",
        link_to: "/empire",
        agent_name: "ARIA",
        status: "unread",
        metadata: { full_ideas: ideas, generated_at: new Date().toISOString() },
      });
    }

    // Also create human tasks for top ideas
    const { data: adminProfile } = await svc
      .from("profiles")
      .select("id")
      .eq("user_id", admins?.[0]?.user_id)
      .maybeSingle();

    if (adminProfile) {
      await svc.from("human_tasks").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        title: "Review weekly improvement ideas from ARIA",
        description: ideas.slice(0, 1000),
        category: "improvement_idea",
        severity: "info",
        status: "open",
        source_agent: "aria",
        assigned_to: adminProfile.id,
      });
    }

    console.log(`✅ Friday ideas generated and ${admins?.length || 0} admin(s) notified`);

    return new Response(JSON.stringify({ ok: true, adminsNotified: admins?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("friday-ideas error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
