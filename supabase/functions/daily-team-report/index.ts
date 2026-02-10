import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard — must be authenticated
    try { await requireAuth(req); } catch (res) { if (res instanceof Response) return res; throw res; }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = `${today}T23:59:59.999Z`;

    // 1. Get all active employees with their profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, title, department")
      .eq("is_active", true);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ ok: true, message: "No active profiles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch all activity data for the day in parallel
    const [
      commsRes, tasksRes, leadsRes, ordersRes, workOrdersRes, deliveriesRes,
      teamMsgsRes, meetingsRes, timeClockRes, chatSessionsRes,
    ] = await Promise.all([
      supabase.from("communications")
        .select("user_id, source, direction, status")
        .gte("received_at", dayStart).lte("received_at", dayEnd),
      supabase.from("tasks")
        .select("assigned_to, status, priority, title")
        .or(`created_at.gte.${dayStart},updated_at.gte.${dayStart}`),
      supabase.from("leads")
        .select("assigned_to, stage, expected_value, title")
        .gte("updated_at", dayStart),
      supabase.from("orders")
        .select("created_by, status, total_amount, order_number")
        .gte("created_at", dayStart).lte("created_at", dayEnd),
      supabase.from("work_orders")
        .select("assigned_to, status, work_order_number")
        .or(`scheduled_start.gte.${dayStart},actual_start.gte.${dayStart}`),
      supabase.from("deliveries")
        .select("driver_name, status, delivery_number")
        .eq("scheduled_date", today),
      supabase.from("team_messages")
        .select("sender_profile_id")
        .gte("created_at", dayStart).lte("created_at", dayEnd),
      supabase.from("team_meetings")
        .select("participants, title, duration_seconds, ai_summary")
        .gte("started_at", dayStart).lte("started_at", dayEnd),
      supabase.from("time_clock_entries")
        .select("profile_id, clock_in, clock_out, hours_worked")
        .gte("clock_in", dayStart),
      supabase.from("chat_sessions")
        .select("user_id, agent_name, title, updated_at")
        .gte("updated_at", dayStart),
    ]);

    const comms = commsRes.data || [];
    const tasks = tasksRes.data || [];
    const leads = leadsRes.data || [];
    const orders = ordersRes.data || [];
    const workOrders = workOrdersRes.data || [];
    const deliveries = deliveriesRes.data || [];
    const teamMsgs = teamMsgsRes.data || [];
    const meetings = meetingsRes.data || [];
    const timeClock = timeClockRes.data || [];
    const chatSessions = chatSessionsRes.data || [];

    // 3. Build per-employee summary
    const employeeSummaries = profiles.map((p) => {
      const uid = p.user_id;
      const pid = p.id;

      const emailsSent = comms.filter((c: any) => c.user_id === uid && c.source === "gmail" && c.direction === "outbound").length;
      const emailsReceived = comms.filter((c: any) => c.user_id === uid && c.source === "gmail" && c.direction === "inbound").length;
      const callsMade = comms.filter((c: any) => c.user_id === uid && c.source === "ringcentral").length;
      const userTasks = tasks.filter((t: any) => t.assigned_to === uid);
      const tasksCompleted = userTasks.filter((t: any) => t.status === "done" || t.status === "completed").length;
      const tasksPending = userTasks.filter((t: any) => t.status !== "done" && t.status !== "completed").length;
      const userLeads = leads.filter((l: any) => l.assigned_to === uid);
      const leadsWorked = userLeads.length;
      const pipelineValue = userLeads.reduce((sum: number, l: any) => sum + (l.expected_value || 0), 0);
      const userOrders = orders.filter((o: any) => o.created_by === uid);
      const userWOs = workOrders.filter((w: any) => w.assigned_to === uid);
      const msgs = teamMsgs.filter((m: any) => m.sender_profile_id === pid).length;
      const clockEntry = timeClock.find((t: any) => t.profile_id === pid);
      const hoursWorked = clockEntry?.hours_worked || (clockEntry?.clock_in && !clockEntry?.clock_out ? "clocked in" : null);
      const aiSessions = chatSessions.filter((s: any) => s.user_id === uid).length;

      return {
        name: p.full_name,
        title: p.title || "",
        department: p.department || "",
        emailsSent,
        emailsReceived,
        callsMade,
        tasksCompleted,
        tasksPending,
        leadsWorked,
        pipelineValue,
        ordersCreated: userOrders.length,
        orderValue: userOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0),
        workOrdersHandled: userWOs.length,
        teamMessages: msgs,
        hoursWorked,
        aiSessions,
      };
    }).filter((e) => 
      // Only include employees with any activity
      e.emailsSent + e.emailsReceived + e.callsMade + e.tasksCompleted + e.tasksPending +
      e.leadsWorked + e.ordersCreated + e.workOrdersHandled + e.teamMessages + e.aiSessions > 0
      || e.hoursWorked !== null
    );

    // Company-wide stats
    const totalOrders = orders.length;
    const totalOrderValue = orders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
    const totalDeliveries = deliveries.length;
    const completedDeliveries = deliveries.filter((d: any) => d.status === "delivered" || d.status === "completed").length;
    const totalMeetings = meetings.length;

    // 4. Generate AI summary
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataContext = `
=== DAILY TEAM REPORT FOR ${today} ===

COMPANY TOTALS:
- Orders: ${totalOrders} (value: $${totalOrderValue.toLocaleString()})
- Deliveries: ${totalDeliveries} scheduled, ${completedDeliveries} completed
- Meetings: ${totalMeetings}
- Active employees with activity: ${employeeSummaries.length}/${profiles.length}

EMPLOYEE ACTIVITY:
${employeeSummaries.map((e) => `
👤 ${e.name} (${e.title || e.department || "Team"})
   📧 Emails: ${e.emailsSent} sent, ${e.emailsReceived} received
   📞 Calls: ${e.callsMade}
   ✅ Tasks: ${e.tasksCompleted} completed, ${e.tasksPending} pending
   💰 Leads: ${e.leadsWorked} worked ($${e.pipelineValue.toLocaleString()} pipeline)
   📦 Orders: ${e.ordersCreated} ($${e.orderValue.toLocaleString()})
   🔧 Work Orders: ${e.workOrdersHandled}
   💬 Team Messages: ${e.teamMessages}
   🤖 AI Sessions: ${e.aiSessions}
   ⏰ Hours: ${e.hoursWorked ?? "not clocked in"}`).join("\n")}

MEETINGS:
${meetings.map((m: any) => `- ${m.title} (${Math.round((m.duration_seconds || 0) / 60)}min)${m.ai_summary ? `: ${m.ai_summary}` : ""}`).join("\n") || "None"}
`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a concise executive assistant. Generate a brief daily team performance summary for the CEO.
Return ONLY a short notification-friendly summary (max 500 chars) covering:
1. Top performers and their key achievements
2. Any concerns (employees not clocked in, too many pending tasks, etc.)
3. Key business metrics (orders, pipeline value)
Keep it punchy, use emojis sparingly. No JSON, just plain text.`,
          },
          { role: "user", content: dataContext },
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
    });

    let summaryText = `📊 Team Report ${today}: ${employeeSummaries.length} active employees, ${totalOrders} orders ($${totalOrderValue.toLocaleString()}), ${completedDeliveries}/${totalDeliveries} deliveries completed.`;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content?.trim();
      if (content) summaryText = content;
    } else {
      console.warn("AI summary failed, using fallback:", aiResponse.status);
    }

    // 5. Find admin users to notify
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminUserIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];

    if (!adminUserIds.length) {
      return new Response(JSON.stringify({ ok: true, message: "No admin users to notify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Insert notification for each admin
    const notifications = adminUserIds.map((uid) => ({
      user_id: uid,
      type: "notification",
      title: `📋 Daily Team Report — ${today}`,
      description: summaryText,
      agent_name: "Eisenhower",
      agent_color: "bg-amber-500",
      priority: "high",
      link_to: "/brain",
      metadata: {
        report_type: "daily_team_report",
        date: today,
        employee_count: employeeSummaries.length,
        total_orders: totalOrders,
        total_order_value: totalOrderValue,
        employees: employeeSummaries,
      },
    }));

    const { error: insertErr } = await supabase.from("notifications").insert(notifications);
    if (insertErr) {
      console.error("Failed to insert notifications:", insertErr);
      throw new Error("Failed to create notification");
    }

    

    return new Response(
      JSON.stringify({ ok: true, adminsNotified: adminUserIds.length, employeesReported: employeeSummaries.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily team report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
