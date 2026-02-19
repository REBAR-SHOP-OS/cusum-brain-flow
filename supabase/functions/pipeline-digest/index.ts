import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (token !== serviceRoleKey) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { company_id, period = "daily" } = body;

    if (!company_id) {
      return new Response(JSON.stringify({ error: "Missing company_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather pipeline stats
    const { data: leads } = await supabase
      .from("leads")
      .select("id, title, stage, expected_value, probability, sla_breached, sla_deadline, escalated_to, updated_at, created_at, win_prob_score, priority_score")
      .eq("company_id", company_id);

    const allLeads = leads || [];
    const terminal = new Set(["won", "lost", "loss", "merged", "archived_orphan"]);
    const active = allLeads.filter(l => !terminal.has(l.stage));
    const won = allLeads.filter(l => l.stage === "won");
    const lost = allLeads.filter(l => l.stage === "lost" || l.stage === "loss");
    const breached = active.filter(l => l.sla_breached);
    const now = Date.now();
    const stale = active.filter(l => (now - new Date(l.updated_at).getTime()) / 86400000 >= 14);

    const totalValue = active.reduce((s, l) => s + ((l.expected_value as number) || 0), 0);
    const weightedValue = active.reduce((s, l) => s + (((l.expected_value as number) || 0) * ((l.probability as number) ?? 50)) / 100, 0);
    const winRate = (won.length + lost.length) > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

    // Recent escalations
    const { data: recentEscalations } = await supabase
      .from("sla_escalation_log")
      .select("entity_type, stage, escalated_to, created_at")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const statsText = `
Pipeline Digest (${period}):
- Active leads: ${active.length}
- Pipeline value: $${totalValue.toLocaleString()}
- Weighted forecast: $${Math.round(weightedValue).toLocaleString()}
- Win rate: ${winRate}%
- Won: ${won.length} | Lost: ${lost.length}
- SLA breaches: ${breached.length}
- Stale leads (14+ days): ${stale.length}
${breached.length > 0 ? `\nBreached leads: ${breached.slice(0, 5).map(l => `${l.title} (${l.stage})`).join(", ")}` : ""}
${stale.length > 0 ? `\nStale leads: ${stale.slice(0, 5).map(l => `${l.title} (${Math.round((now - new Date(l.updated_at).getTime()) / 86400000)}d)`).join(", ")}` : ""}
${recentEscalations?.length ? `\nRecent escalations: ${recentEscalations.slice(0, 5).map((e: any) => `${e.stage} → ${e.escalated_to}`).join(", ")}` : ""}
    `.trim();

    // Generate AI summary
    let aiSummary = statsText;
    if (GEMINI_API_KEY) {
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_API_KEY}` },
            body: JSON.stringify({
              model: "gemini-2.5-flash",
              messages: [
                { role: "system", content: "You are Blitz, AI sales assistant for rebar.shop. Write a concise executive pipeline digest email. Use bullet points, highlight critical issues first. Keep under 300 words." },
                { role: "user", content: `Generate a ${period} pipeline digest:\n\n${statsText}` },
              ],
              temperature: 0.5,
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          aiSummary = data.choices?.[0]?.message?.content || statsText;
        }
      } catch (e) {
        console.warn("AI digest generation failed, using raw stats:", e);
      }
    }

    // Get configured recipients (admin + sales roles)
    const { data: recipients } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "sales"]);

    if (recipients) {
      for (const r of recipients) {
        try {
          await supabase.from("notifications").insert({
            user_id: r.user_id,
            type: "notification",
            title: `📊 ${period === "weekly" ? "Weekly" : "Daily"} Pipeline Digest`,
            description: aiSummary.slice(0, 500),
            priority: breached.length > 0 ? "high" : "normal",
            link_to: "/pipeline/intelligence",
            agent_name: "Blitz",
            status: "unread",
            metadata: { digest_type: period, generated_at: new Date().toISOString() },
          });
        } catch (e) {
          console.warn("Failed to notify:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        digest: aiSummary,
        stats: { active: active.length, totalValue, weightedValue: Math.round(weightedValue), winRate, breached: breached.length, stale: stale.length },
        notified: recipients?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pipeline-digest error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
